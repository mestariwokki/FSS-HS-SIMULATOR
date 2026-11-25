"""Fit one and two thermal nodes to the Zenodo 17938718 pouch-cell maps."""

import argparse
import hashlib
from pathlib import Path

import h5py
import numpy as np
from scipy.optimize import least_squares


def experiment(group):
    time = group["time"][:].ravel()
    current = group["current"][:].ravel()
    maps = group["temperature"][:]
    y = group["y"][:].ravel()
    # The edge is the top fifth of the imaged cell surface.
    edge = y >= np.quantile(y, 0.8)
    valid = np.all(np.isfinite(maps), axis=-1)
    edge_mask = valid & edge[np.newaxis, :]
    bulk_mask = valid & ~edge[np.newaxis, :]
    observed = np.array([maps[bulk_mask].mean(axis=0), maps[edge_mask].mean(axis=0)])
    weight = edge_mask.sum() / valid.sum()
    return time, current, observed, weight


def integrate(time, current, initial, source, decay):
    result = np.empty_like(time)
    result[0] = initial
    for n, dt in enumerate(np.diff(time), start=1):
        # Source is temperature rise in K/s at 75 A.
        forcing = source * (current[n - 1] / 75)**2
        result[n] = result[n - 1] * np.exp(-decay * dt) + forcing * -np.expm1(-decay * dt) / decay
    return result


def predict(parameters, sample):
    time, current, observed, edge_weight = sample
    base_source, cooling = parameters[:2]
    weights = np.array([1 - edge_weight, edge_weight])
    ambient = weights @ observed[:, 0]
    if len(parameters) == 2:
        mean = ambient + integrate(time, current, 0, base_source, cooling)
        return np.stack([mean, mean])
    edge_source, coupling = parameters[2:]
    mean_source = weights @ [base_source, edge_source]
    mean = ambient + integrate(time, current, 0, mean_source, cooling)
    difference = integrate(time, current, observed[1, 0] - observed[0, 0],
                           edge_source - base_source, cooling + coupling)
    return np.stack([mean - edge_weight * difference, mean + (1 - edge_weight) * difference])


def main(path):
    print("SHA-256", hashlib.sha256(path.read_bytes()).hexdigest())
    with h5py.File(path) as data:
        training = [experiment(data[key]) for key in ("1C_discharge", "2C_discharge")]
        held_out = experiment(data["3C_discharge"])
        pixel_peak = np.nanmax(data["3C_discharge"]["temperature"][:], axis=(0, 1))

    def residual(parameters):
        return np.concatenate([(predict(parameters, sample) - sample[2]).ravel() for sample in training])

    time, _, measured, _ = held_out
    for name, curve in zip(("runko", "reuna", "kuumin pikseli"), (*measured, pixel_peak)):
        index = np.argmax(curve)
        print(f"Mitattu {name}: {curve[index]:.3f} °C @ {time[index]:.1f} s")
    for initial in ([0.005, 1e-4], [0.005, 1e-4, 0.006, 1e-3]):
        fit = least_squares(residual, initial, bounds=(1e-9, np.inf),
                            ftol=1e-10, xtol=1e-10, gtol=1e-10)
        if not fit.success:
            raise RuntimeError(fit.message)
        print(f"{len(initial)//2} solmua, parametrit:", fit.x.tolist())
        print(f"Sovitus-RMSE {np.sqrt(np.mean(fit.fun**2)):.3f} °C")
        for name, modeled, actual in zip(("runko", "reuna"), predict(fit.x, held_out), measured):
            index = np.argmax(modeled)
            rmse = np.sqrt(np.mean((modeled - actual)**2))
            print(f"3C {name}: RMSE {rmse:.3f} °C, huippu {modeled[index]:.3f} °C @ {time[index]:.1f} s")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path)
    main(parser.parse_args().file)
