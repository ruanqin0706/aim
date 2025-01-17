import logging
from pathlib import Path
from filelock import FileLock

import aimrocks

from typing import Iterator, Optional, Tuple

from aim.storage.container import Container
from aim.storage.prefixview import PrefixView
from aim.storage.treeview import TreeView


logger = logging.getLogger(__name__)


class RocksContainer(Container):
    """
    TODO Rocks-specific docs
    """
    def __init__(
        self,
        path: str,
        read_only: bool = False,
        wait_if_busy: bool = False
    ) -> None:
        self.path = Path(path)
        self.read_only = read_only
        self._db_opts = dict(
            create_if_missing=True,
            paranoid_checks=False,
            keep_log_file_num=10,
            skip_stats_update_on_db_open=True,
            skip_checking_sst_file_sizes_on_db_open=True,
            max_open_files=-1,
            write_buffer_size=64 * 1024 * 1024,  # 64MB
            max_write_buffer_number=3,
            target_file_size_base=64 * 1024 * 1024,  # 64MB
            max_background_compactions=4,
            level0_file_num_compaction_trigger=8,
            level0_slowdown_writes_trigger=17,
            level0_stop_writes_trigger=24,
            num_levels=4,
            max_bytes_for_level_base=512 * 1024 * 1024,  # 512MB
            max_bytes_for_level_multiplier=8,
        )
        # opts.allow_concurrent_memtable_write = False
        # opts.memtable_factory = aimrocks.VectorMemtableFactory()
        # opts.table_factory = aimrocks.PlainTableFactory()
        # opts.table_factory = aimrocks.BlockBasedTableFactory(block_cache=aimrocks.LRUCache(67108864))
        # opts.write_buffer_size = 67108864
        # opts.arena_block_size = 67108864

        self._db = None
        self._lock = None
        self._wait_if_busy = wait_if_busy  # TODO implement
        self._lock_path: Optional[Path] = None
        self._progress_path: Optional[Path] = None
        if not self.read_only:
            self.writable_db
        # TODO check if Containers are reopenable

    @property
    def db(self) -> aimrocks.DB:
        if self._db is not None:
            return self._db

        logger.debug(f'opening {self.path} as aimrocks db')
        self.path.parent.mkdir(parents=True, exist_ok=True)
        locks_dir = self.path.parent.parent / 'locks'
        locks_dir.mkdir(parents=True, exist_ok=True)

        if not self.read_only:
            self._lock_path = locks_dir / self.path.name
            self._lock = FileLock(str(self._lock_path), timeout=10)
            self._lock.acquire()

        self._db = aimrocks.DB(str(self.path),
                               aimrocks.Options(**self._db_opts),
                               read_only=self.read_only)

        return self._db

    @property
    def writable_db(self) -> aimrocks.DB:
        db = self.db
        if self._progress_path is None:
            progress_dir = self.path.parent.parent / 'progress'
            progress_dir.mkdir(parents=True, exist_ok=True)
            self._progress_path = progress_dir / self.path.name
            self._progress_path.touch(exist_ok=True)
        return db

    def finalize(self, *, index: Container):
        """Finalize the Container.

        Store the collection of `(key, value)` records in the :obj:`Container`
        `index` for fast reads.
        """
        if not self._progress_path:
            return

        for k, v in self.items():
            index[k] = v

        self._progress_path.unlink()
        self._progress_path = None

    def close(self):
        """Close all the resources."""
        if self._lock is not None:
            self._lock.release()
            self._lock = None
        if self._db is not None:
            # self._db.close()
            self._db = None

    def __del__(self):
        """Automatically close all the resources after being garbage-collected"""
        self.close()

    def preload(self):
        """Preload the Container in the read mode."""
        self.db

    def tree(self) -> 'TreeView':
        """Return a :obj:`TreeView` which enables hierarchical view and access
        to the container records.

        This is achieved by prefixing groups and using `PATH_SENTINEL` as a
        separator for keys.

        For example, if the Container contents are:
            `{
                b'e.y': b'012',
                b'meta.x': b'123',
                b'meta.z': b'x',
                b'zzz': b'oOo'
            }`, and the path sentinel is `b'.'` then `tree = container.tree()`
            will behave as a (possibly deep) dict-like object:
            `tree[b'meta'][b'x'] == b'123'`
        """
        return TreeView(self)

    def get(
        self,
        key: bytes,
        default=None
    ) -> bytes:
        """Returns the value by the given `key` if it exists else `default`.

        The `default` is :obj:`None` by default.
        """
        raise NotImplementedError

    def __getitem__(
        self,
        key: bytes
    ) -> bytes:
        """Returns the value by the given `key`."""
        return self.db.get(key=key)

    def set(
        self,
        key: bytes,
        value: bytes,
        *,
        store_batch: aimrocks.WriteBatch = None
    ):
        """Set a value for given key, optionally store in a batch.

        If `store_batch` is provided, instead of the `(key, value)` being added
        to the collection immediately, the operation is stored in a batch in
        order to be executed in a whole with other write operations.

        See :obj:`RocksContainer.batch` and :obj:`RocksContainer.commit` for
        more details.
        """
        if store_batch is not None:
            target = store_batch
        else:
            target = self.writable_db

        target.put(key=key, value=value)

    def __setitem__(
        self,
        key: bytes,
        value: bytes
    ):
        """Set a value for given key."""
        self.writable_db.put(key=key, value=value)

    def delete(
        self,
        key: bytes,
        *,
        store_batch: aimrocks.WriteBatch = None
    ):
        """Delete a key-value record by the given key,
        optionally store in a batch.

        If `store_batch` is provided, instead of the `(key, value)` being added
        to the collection immediately, the operation is stored in a batch in
        order to be executed in a whole with other write operations.

        See :obj:`RocksContainer.batch` and :obj:`RocksContainer.commit` for
        more details.
        """
        if store_batch is not None:
            target = store_batch
        else:
            target = self.writable_db

        target.delete(key)

    def __delitem__(
        self,
        key: bytes
    ) -> None:
        """Delete a key-value record by the given key."""
        return self.writable_db.delete(key)

    def delete_range(
        self,
        begin: bytes,
        end: bytes,
        *,
        store_batch: aimrocks.WriteBatch = None
    ):
        """Delete all the records in the given `[begin, end)` key range,
        optionally store in a batch.

        If `store_batch` is provided, instead of the `(key, value)` being added
        to the collection immediately, the operation is stored in a batch in
        order to be executed in a whole with other write operations.

        See :obj:`RocksContainer.batch` and :obj:`RocksContainer.commit` for
        more details.
        """
        if store_batch is not None:
            target = store_batch
        else:
            target = self.writable_db

        target.delete_range((begin, end))

    def items(
        self,
        prefix: bytes = b''
    ) -> Iterator[Tuple[bytes, bytes]]:
        """Iterate over all the key-value records in the prefix key range.

        The iteration is always performed in lexiographic order w.r.t keys.
        If `prefix` is provided, iterate only over those records that have key
        starting with the `prefix`.

        For example, if `prefix == b'meta.'`, and the Container consists of:
        `{
            b'e.y': b'012',
            b'meta.x': b'123',
            b'meta.z': b'x',
            b'zzz': b'oOo'
        }`, the method will yield `(b'meta.x', b'123')` and `(b'meta.z', b'x')`

        Args:
            prefix (:obj:`bytes`): the prefix that defines the key range
        """
        # TODO return ValuesView, not iterator
        it: Iterator[Tuple[bytes, bytes]] = self.db.iteritems()
        it.seek(prefix)
        for key, val in it:
            if not key.startswith(prefix):
                break
            yield key, val

    def walk(
        self,
        prefix: bytes = b''
    ):
        """A bi-directional generator to walk over the collection of records on
        any arbitrary order. The `prefix` sent to the generator (lets call it
        a `walker`) seeks for lower-bound key in the collection.

        In other words, if the Container contents are:
        `{
            b'e.y': b'012',
            b'meta.x': b'123',
            b'meta.z': b'x',
            b'zzz': b'oOo'
        }` and `walker = container.walk()` then:
        `walker.send(b'meta') == b'meta.x'`, `walker.send(b'e.y') == b'e.y'`
        """
        it: Iterator[Tuple[bytes, bytes]] = self.db.iteritems()
        it.seek(prefix)

        while True:
            try:
                key, val = next(it)
            except StopIteration:
                yield None
                break
            jump = yield key
            it.seek(jump)

    def keys(
        self,
        prefix: bytes = b''
    ):
        """Iterate over all the keys in the prefix range.

        The iteration is always performed in lexiographic order.
        If `prefix` is provided, iterate only over keys starting with
        the `prefix`.

        For example, if `prefix == b'meta.'`, and the Container consists of:
        `{
            b'e.y': b'012',
            b'meta.x': b'123',
            b'meta.z': b'x',
            b'zzz': b'oOo'
        }`, the method will yield `b'meta.x'` and `b'meta.z'`

        Args:
            prefix (:obj:`bytes`): the prefix that defines the key range
        """
        # TODO return KeyView, not iterator
        it: Iterator[Tuple[bytes, bytes]] = self.db.iterkeys()
        it.seek(prefix)
        for key in it:
            if not key.startswith(prefix):
                break
            yield key

    def values(
        self,
        prefix: bytes = b''
    ):
        """Iterate over all the values in the given prefix key range.

        The iteration is always performed in lexiographic order w.r.t keys.
        If `prefix` is provided, iterate only over those record values that have
        key starting with the `prefix`.

        For example, if `prefix == b'meta.'`, and the Container consists of:
        `{
            b'e.y': b'012',
            b'meta.x': b'123',
            b'meta.z': b'x',
            b'zzz': b'oOo'
        }`, the method will yield `b'123'` and `b'x'`

        Args:
            prefix (:obj:`bytes`): the prefix that defines the key range
        """
        raise NotImplementedError

    def update(
        self
    ) -> None:
        raise NotImplementedError

    def view(
        self,
        prefix: bytes = b''
    ) -> 'Container':
        """Return a view (even mutable ones) that enable access to the container
        but with modifications.

        Args:
            prefix (:obj:`bytes`): the prefix that defines the key range of the
                view-container. The resulting container will share an access to
                only records in the `prefix` key range, but with `prefix`-es
                stripped from them.

                For example, if the Container contents are:
                `{
                    b'e.y': b'012',
                    b'meta.x': b'123',
                    b'meta.z': b'x',
                    b'zzz': b'oOo'
                }`, then `container.view(prefix=b'meta.')` will behave (almost)
                exactly as an Container:
                `{
                    b'x': b'123',
                    b'z': b'x',
                }`
        """
        return PrefixView(prefix=prefix, container=self)

    def batch(
        self
    ) -> aimrocks.WriteBatch:
        """Creates a new batch object to store operations in before executing
        using :obj:`RocksContainer.commit`.

        The operations :obj:`RocksContainer.set`, :obj:`RocksContainer.delete`,
        :obj:`RocksContainer.delete_range` are supported.

        See more at :obj:`RocksContainer.commit`
        """
        return aimrocks.WriteBatch()

    def commit(
        self,
        batch: aimrocks.WriteBatch
    ):
        """Execute the accumulated write operations in the given `batch`.

        The `RocksContainer` features atomic writes for batches.
        """
        self.writable_db.write(batch)

    def next_key(
        self,
        prefix: bytes = b''
    ) -> bytes:
        """Returns the key that comes (lexicographically) right after the
        provided `key`.
        """
        it: Iterator[bytes] = self.db.iterkeys()
        it.seek(prefix + b'\x00')
        key = next(it)

        if not key.startswith(prefix):
            raise KeyError

        return key

    def next_value(
        self,
        prefix: bytes = b''
    ) -> bytes:
        """Returns the value for the key that comes (lexicographically) right
        after the provided `key`.
        """
        key, value = self.next_key_value(prefix)
        return value

    def next_key_value(
        self,
        prefix: bytes = b''
    ) -> Tuple[bytes, bytes]:
        """Returns `(key, value)` for the key that comes (lexicographically)
        right after the provided `key`.
        """
        it: Iterator[Tuple[bytes, bytes]] = self.db.iteritems()
        it.seek(prefix + b'\x00')

        key, value = next(it)

        if not key.startswith(prefix):
            raise KeyError

        return key, value

    def prev_key(
        self,
        prefix: bytes = b''
    ) -> bytes:
        """Returns the key that comes (lexicographically) right before the
        provided `key`.
        """
        key, value = self.prev_key_value(prefix)
        return key

    def prev_value(
        self,
        prefix: bytes = b''
    ) -> bytes:
        """Returns the value for the key that comes (lexicographically) right
        before the provided `key`.
        """
        key, value = self.prev_key_value(prefix)
        return value

    def prev_key_value(
        self,
        prefix: bytes = b''
    ) -> Tuple[bytes, bytes]:
        """Returns `(key, value)` for the key that comes (lexicographically)
        right before the provided `key`.
        """
        it: Iterator[Tuple[bytes, bytes]] = self.db.iteritems()
        it.seek_for_prev(prefix + b'\xff')

        key, value = it.get()

        return key, value
