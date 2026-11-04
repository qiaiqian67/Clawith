"""A cross-platform exclusive file lock.

The local storage backend takes an exclusive lock on a directory while it
replaces a tree. On Linux that is `flock`; on Windows it is the lock file
API, which `msvcrt` exposes. The lock is held across the caller's work, and
it is released when the caller releases it.

The lock is non-blocking. A caller that cannot take it waits outside this
module, so a slow holder does not block the event loop.
"""

from __future__ import annotations

import errno
import os
from types import ModuleType


def _load_fcntl() -> ModuleType | None:
    """The `fcntl` module, when this platform has one."""
    try:
        import fcntl
    except ImportError:
        return None
    return fcntl


def _load_msvcrt() -> ModuleType | None:
    """The `msvcrt` module, when this platform has one."""
    try:
        import msvcrt
    except ImportError:
        return None
    return msvcrt


_FCNTL = _load_fcntl()
_MSVCRT = _load_msvcrt()


def acquire(file_descriptor: int) -> None:
    """Take the exclusive lock on an open file descriptor.

    Raises an `OSError` when another holder has it.
    """
    fcntl = _FCNTL
    if fcntl is not None:
        fcntl.flock(file_descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return

    msvcrt = _MSVCRT
    if msvcrt is not None:
        # msvcrt locks one byte at the current position of the descriptor.
        os.lseek(file_descriptor, 0, os.SEEK_SET)
        msvcrt.locking(file_descriptor, msvcrt.LK_NBLCK, 1)
        return

    # Neither platform module is there. The lock becomes a no-op, so the
    # caller still works and only loses the exclusion.
    return


def release(file_descriptor: int) -> None:
    """Give the exclusive lock back."""
    fcntl = _FCNTL
    if fcntl is not None:
        fcntl.flock(file_descriptor, fcntl.LOCK_UN)
        return

    msvcrt = _MSVCRT
    if msvcrt is not None:
        os.lseek(file_descriptor, 0, os.SEEK_SET)
        msvcrt.locking(file_descriptor, msvcrt.LK_UNLCK, 1)
        return

    return


def is_lock_conflict(error: OSError) -> bool:
    """Whether an error means the lock is held by another holder.

    The two platforms report that in different ways. `flock` raises
    `BlockingIOError`. The Windows lock call reports it as a permission
    error, because the runtime maps ERROR_LOCK_VIOLATION onto `EACCES`.
    """
    if _FCNTL is not None and isinstance(error, BlockingIOError):
        return True
    if _MSVCRT is not None:
        # ERROR_LOCK_VIOLATION is 33, and ERROR_SHARING_VIOLATION is 32.
        winerror = getattr(error, "winerror", None)
        if winerror in {32, 33}:
            return True
        # The runtime maps a lock violation onto EACCES and onto EDEADLOCK.
        return error.errno in {errno.EACCES, errno.EDEADLOCK}
    return False
