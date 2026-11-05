"""Export the canonical core notebook as a Python interactive-cell script."""

import argparse
import json
from pathlib import Path

LAB_ROOT = Path(__file__).resolve().parent.parent


def render_demo(notebook_path=None):
    notebook_path = Path(notebook_path) if notebook_path else LAB_ROOT / "notebooks/metrics_core.ipynb"
    notebook = json.loads(notebook_path.read_text(encoding="utf-8"))
    parts = []
    for cell in notebook["cells"]:
        source = cell["source"]
        if isinstance(source, list):
            source = "".join(source)
        if cell["cell_type"] == "markdown":
            parts.append("# %% [markdown]\n" + "\n".join("# " + line for line in source.splitlines()))
        elif cell["cell_type"] == "code":
            parts.append("# %%\n" + source.rstrip())
    return "\n\n".join(parts) + "\n"


def export_demo(notebook_path=None, output_path=None):
    output_path = Path(output_path) if output_path else LAB_ROOT / "scripts/metrics_demo.py"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(render_demo(notebook_path), encoding="utf-8")
    return output_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--notebook", type=Path, default=LAB_ROOT / "notebooks/metrics_core.ipynb")
    parser.add_argument("--output", type=Path, default=LAB_ROOT / "scripts/metrics_demo.py")
    arguments = parser.parse_args()
    result = export_demo(arguments.notebook, arguments.output)
    print(f"Exported {result.name} from {arguments.notebook.name}.")
