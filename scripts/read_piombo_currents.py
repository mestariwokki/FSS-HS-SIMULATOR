"""Extract calibrated module and Hall current columns from Piombo v1 to JSON."""

import argparse
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
import sys
from zipfile import ZipFile

import numpy as np
from scipy.io import loadmat
from scipy.io.matlab._mio5 import MatFile5Reader

MEMBER = "/Processed_data/NMC_cells/Unaged/R_3/T_25/M1_NMC_Unaged_R3_T25.mat"


def extract(archive):
    with ZipFile(archive) as dataset:
        name, = [name for name in dataset.namelist() if name.endswith(MEMBER)]
        payload = dataset.read(name)
    print(name, sha256(payload).hexdigest(), file=sys.stderr)
    # This release stores a MATLAB table in an MCOS subsystem. Read the
    # numeric column payload and verify its column names before selecting data.
    workspace = loadmat(BytesIO(payload))["__function_workspace__"].tobytes()
    if workspace[:4] != b"\x00\x01IM":
        raise ValueError("Unexpected MAT subsystem header")
    stream = BytesIO(workspace)
    stream.seek(8)
    reader = MatFile5Reader(stream, byte_order="<")
    reader.initialize_read()
    header, _ = reader.read_var_header()
    wrapper = reader.read_var_array(header, process=False)["MCOS"][0, 0]["arr"][0].ravel()
    names = [name.item() for name in wrapper[7].ravel()]
    columns = dict(zip(names, (column.ravel() for column in wrapper[2].ravel()), strict=True))
    selected = ["Step_Index", "Step_Times", "CurrentA", *(f"CurrentA_Cell_{n}" for n in range(1, 5))]
    return np.stack([columns[name] for name in selected], axis=-1).tolist()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    json.dump(extract(parser.parse_args().archive), sys.stdout, allow_nan=False)
