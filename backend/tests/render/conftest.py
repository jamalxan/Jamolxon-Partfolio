from __future__ import annotations

import copy
import json
import sys
from pathlib import Path
from typing import Any

import pytest

BACKEND = Path(__file__).resolve().parents[2]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

SEED = BACKEND / "seed" / "content.json"


@pytest.fixture(scope="session")
def seed_content() -> dict[str, Any]:
    return json.loads(SEED.read_text(encoding="utf-8"))


@pytest.fixture()
def content(seed_content: dict[str, Any]) -> dict[str, Any]:
    return copy.deepcopy(seed_content)


@pytest.fixture(scope="session")
def site(tmp_path_factory: pytest.TempPathFactory, seed_content: dict[str, Any]) -> tuple[Path, list[str]]:
    from app.render import render_site

    out = tmp_path_factory.mktemp("render") / "site"
    paths = render_site(copy.deepcopy(seed_content), out)
    return out, paths
