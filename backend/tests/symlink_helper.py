"""A helper that creates a symbolic link where the platform allows one.

Windows grants the right to create a symbolic link only to an elevated
process, or to a developer mode installation. A test that needs a symbolic
link to prove a refusal skips itself when the platform refuses to make one,
instead of failing on the platform.
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest


def make_symlink(link_path: Path, target: Path) -> None:
    """Create a symbolic link, or skip the test when the platform refuses."""
    try:
        os.symlink(target, link_path, target_is_directory=target.is_dir())
    except (OSError, NotImplementedError) as exc:
        pytest.skip(f"This platform does not allow a symbolic link here: {exc}")
