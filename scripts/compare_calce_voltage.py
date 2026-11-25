"""Fit CALCE INR18650-20R pulses and replay the first held-out US06 cycle."""

import argparse
import hashlib
from pathlib import Path
from zipfile import ZipFile

import numpy as np
import pandas as pd
from scipy.optimize import least_squares

COLUMNS = ["Test_Time(s)", "Current(A)", "Voltage(V)", "Step_Index",
           "Discharge_Capacity(Ah)", "Charge_Capacity(Ah)"]


def read_channel(directory, archive, workbook, sheet):
    path = directory / archive
    print(archive, hashlib.sha256(path.read_bytes()).hexdigest())
    with ZipFile(path) as data, data.open(workbook) as source:
        return pd.read_excel(source, sheet_name=sheet, usecols=COLUMNS)


def trace(frame, ocv_curve):
    time = frame[COLUMNS[0]].to_numpy()
    dt = np.diff(time, prepend=time[0])
    if not np.all(dt[1:] > 0):
        raise ValueError("Aikaleimojen pitää kasvaa")
    current = -frame[COLUMNS[1]].to_numpy()
    voltage = frame[COLUMNS[2]].to_numpy()
    discharged = frame[COLUMNS[4]].to_numpy() - frame[COLUMNS[5]].to_numpy()
    discharged -= discharged[0]
    if np.any(discharged < -1e-6) or np.max(discharged) > ocv_curve[-1, 0]:
        raise ValueError("Mittaus on OCV-kalibroinnin ulkopuolella")
    ocv = np.interp(discharged, ocv_curve[:, 0], ocv_curve[:, 1])
    return dt, current, voltage, ocv


def predict(parameters, data):
    dt, current, _, ocv = data
    prediction = ocv - parameters[0] * current
    for resistance, tau in parameters[1:].reshape(-1, 2):
        alpha = np.exp(-dt / tau)
        forcing = -np.expm1(-dt / tau) * resistance * current
        polarization = 0.0
        for index in range(len(dt)):
            polarization = alpha[index] * polarization + forcing[index]
            prediction[index] -= polarization
    return prediction


def print_metrics(label, prediction, measured, dt, current):
    error = prediction - measured
    energy = [np.dot(dt * current, voltage) / 3600 for voltage in (measured, prediction)]
    print(f"{label} RMSE={1e3 * np.sqrt(np.mean(error**2)):.3f} mV "
          f"max={1e3 * np.max(np.abs(error)):.3f} mV "
          f"nettoenergia={energy[1]:.6f} / {energy[0]:.6f} Wh")


def main(directory, split_tau):
    pulses = read_channel(directory, "SP3_25C_IC_OCV_12_2_2015.zip",
                          "12_2_2015_Incremental OCV test_SP20-3.xlsx", 1)
    # Complete discharge pulses and the full intervening rests in the first sheet.
    pulses = pulses.loc[pulses[COLUMNS[3]].isin([4, 5, 6])]
    groups = pulses[COLUMNS[3]].ne(pulses[COLUMNS[3]].shift()).cumsum()
    pulses = pulses.loc[groups <= 17]
    rests = pulses.loc[pulses[COLUMNS[3]].isin([4, 6])]
    anchors = rests.groupby(groups).tail(1)
    curve = anchors[[COLUMNS[4], COLUMNS[2]]].to_numpy()
    # Retain the first and last reading of each stage. Thin long rests for the fit.
    parts = []
    for _, stage in pulses.groupby(groups):
        if stage[COLUMNS[3]].iat[0] != 5:
            stage = stage.iloc[np.unique(np.r_[np.arange(0, 60), np.arange(60, len(stage), 30), len(stage) - 1])]
        parts.append(stage)
    training = trace(pd.concat(parts), curve)
    fits = {}
    second_order_bounds = (
        ([0, 0, 0.2, 0, 20], [0.5, 0.5, 20, 0.5, 2000])
        if split_tau else
        ([0, 0, 0.2, 0, 0.2], [0.5, 0.5, 2000, 0.5, 2000])
    )
    for count, initial, lower, upper in [
        (1, [0.08, 0.05, 40], [0, 0, 0.2], [0.5, 0.5, 2000]),
        (2, [0.08, 0.03, 5, 0.04, 100], *second_order_bounds),
    ]:
        fit = least_squares(lambda p: predict(p, training) - training[2], initial,
                            bounds=(lower, upper))
        if not fit.success:
            raise RuntimeError(fit.message)
        fits[count] = fit.x

    drive = read_channel(directory, "SP2_25C_US06.zip",
                         "11_11_2015_SP20-2_US06_80SOC.xls", 1)
    # Initialize both RC states at the end of the full-charge rest. Propagate
    # through SOC preparation and score only the first full 600 s drive cycle.
    steps = drive[COLUMNS[3]].to_numpy()
    start = np.flatnonzero(steps == 4)[-1]
    cycle_start = np.flatnonzero(steps == 7)[0]
    cycle_end = np.flatnonzero(steps == 8)[0] + 1
    held_out = trace(drive.iloc[start:cycle_end], curve)
    score = slice(cycle_start - start, cycle_end - start)
    print(f"US06: {len(held_out[0][score])} näytettä")
    step = np.flatnonzero(training[1] > 0.5)[0]
    recovery = step + np.flatnonzero(training[1][step:] < 0.5)[0]
    for count, parameters in fits.items():
        print(f"{count}RC parametrit (Ω, s): {parameters.tolist()}")
        pulse = predict(parameters, training)
        print_metrics("Sovitus", pulse, training[2], training[0], training[1])
        for label, v in [("mitattu", training[2]), ("malli", pulse)]:
            print(f"{label}: kuoppa {(v[step-1] - min(v[step:recovery]))*1e3:.3f} mV, "
                  f"palautuma {(v[recovery+60] - v[recovery-1])*1e3:.3f} mV")
        print_metrics("US06", predict(parameters, held_out)[score],
                      held_out[2][score], held_out[0][score], held_out[1][score])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--split-tau", action="store_true",
                        help="Rajaa nopea ja hidas aikavakio 20 sekunnin eri puolille")
    args = parser.parse_args()
    main(args.directory, args.split_tau)
