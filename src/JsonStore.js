function JsonStore() {
    this._data = {};
    this._subscriptions = {};
    this._globalSubscriptions = [];
}

JsonStore.prototype = {
    _mixin: function _mixin(path, data, overwrite) {
        var A = Array, O = Object;
        data = salt.clone(data);

        var dir = path.split("."), key = dir.pop();
        dir = dir.length ? dir.join(".") : null;
        var queue = [], spec = [salt.keypath(this._data, dir, true), key, data, path];

        var notify = [], notifySubtree = [];

        do {
            var toObj = spec[0], toKey = spec[1], from = spec[2];
            var to = toObj[toKey], currentPath = spec[3];

            if (to instanceof A) {
                if (overwrite) {
                    toObj[toKey] = from instanceof A ? to.concat(from) : from;
                    notify.push(currentPath);
                }
            }
            else if (to instanceof O && from instanceof O) {
                for (var p in from) {
                    if (from.hasOwnProperty(p)) {
                        queue.push([to, p, from[p], currentPath + "." + p]);
                    }
                }
                notify.push(currentPath);
            }
            else if (overwrite || !toObj.hasOwnProperty(toKey)) {
                toObj[toKey] = from;
                (to instanceof O || from instanceof O ?
                    notifySubtree : notify
                ).push(currentPath);
            }
        } while ((spec = queue.shift()));

        this._notify(notifySubtree, path, notify);
    },

    _invokeCallbacks: function(callbacks, dataPath, eventPath) {
        if (!callbacks || !callbacks.length) { return; }
        eventPath || (eventPath = dataPath);
        var data = salt.keypath(this._data, dataPath), clone = salt.clone, defer = salt.defer;
        for (var i = 0, callback; (callback = callbacks[i]); i += 3) {
            var cutoff = callbacks[i+2];
            var path;
            if (eventPath == null || cutoff > (eventPath && eventPath.length)) {
                path = null
            }
            else {
                path = eventPath.slice(cutoff);
            }
            defer(callback, {
                data: clone(data),
                handle: callbacks[i+1],
                path: path,
                store: this
            });
        }
    },

    _notify: function _notify(withSubtree, parentsOf, withoutSubtree) {
        var notified = [];

        // The queue contains the paths without subtree notifiying first and
        // paths with subtree notifying last
        var queue = withoutSubtree;
        queue = queue ? withSubtree && queue.concat(withSubtree) || queue : withSubtree;

        // in the queue, indexes >= (length of paths without subtree) need their
        // subtrees to be notified
        var withoutSubtreeLen = withoutSubtree.length || 0;

        var subscriptions = this._subscriptions;
        if (queue) {
            // notify each queued path
            var initialLength = queue.length;
            for (var path, i = 0; (path = queue.shift()) != null; i++) {
                // get subscriptions for path
                var subs = subscriptions[path];
                if (!subs || notified.indexOf(path) !== -1) { continue; }

                // enqueue children if subtree is to be notified
                var children;
                if (i >= withoutSubtreeLen && (children = subs.children)) {
                    queue = queue.concat(children);
                }

                // invoke callbacks for path
                this._invokeCallbacks(subs.callbacks, path);

                notified.push(path);
            }
        }

        // notify parent paths
        for (var i = 0, len = parentsOf && parentsOf.length; i < len; i++) {
            var path = parentsOf[i], parentPath = path;
            while (parentPath.indexOf(".") !== -1) {
                parentPath = parentPath.replace(/[.][^.]*$/, '');
                if (notified.indexOf(parentPath) !== -1) {
                    continue;
                }

                // invoke callbacks for path
                var subs = subscriptions[parentPath];
                this._invokeCallbacks(subs && subs.callbacks, parentPath, path);
            }
            this._invokeCallbacks(this._globalSubscriptions, null, path);
        }
    },

    substore: function(path) {
        return new this.SubStore(this, path);
    },

    fill: function fill(path, data) {
        this._mixin(path, data, false);
    },

    set: function set(path, value) {
        var dir = path.split("."), key = dir.pop();
        dir = dir.length ? dir.join(".") : null;

        var currentData = salt.keypath(this._data, dir, true);
        var notifications = [];
        notifications[currentData[key] instanceof Object ? 0 : 1] = path;
        currentData[key] = salt.clone(value);

        var withSubtree = notifications[0], withoutSubtree = notifications[1];
        this._notify(withSubtree != null && [withSubtree],
                     [path],
                     withoutSubtree != null && [withoutSubtree]);
    },

    sub: function subscribe(path, callback, handle, _cutLeadingChars) {
        if (typeof callback !== "function") {
            throw Error("Only functions supported");
        }

        if (path == null) {
            var callbacks = this._globalSubscriptions;
        }
        else {
            var subscriptions = this._subscriptions, undef;

            var segments = path.split("."), currentPath = path, lastPath;
            while (segments.length && !subscriptions.hasOwnProperty(currentPath)) {
                subscriptions[currentPath] = {
                    callbacks: [],
                    children: lastPath ? [lastPath] : []
                };

                lastPath = currentPath;
                segments.pop();
                currentPath = segments.join(".");
            }

            if (lastPath != null && segments.length) {
                var children = subscriptions[currentPath].children;
                if (children.indexOf(lastPath) === -1) {
                    children.push(lastPath);
                }
            }

            var callbacks = subscriptions[path].callbacks;
        }

        if (callbacks.indexOf(callback) === -1) {
            callbacks.push(callback, handle, _cutLeadingChars);
        }

        this._invokeCallbacks([callback, handle, _cutLeadingChars], path);
    },

    unsub: function unsubscribe(path, callback) {
        if (typeof callback !== "function") {
            throw Error("Only functions supported");
        }
        if (path == null) {
            var callbacks = this._globalSubscriptions;
        }
        else {
            var subscription = this._subscriptions[path];
            var callbacks = subscription && subscription.callbacks;
        }
        var idx = callbacks && callbacks.indexOf(callback) || -1;
        if (idx !== -1) {
            callbacks.splice(idx, 3);
        }
    },

    update: function update(path, data) {
        this._mixin(path, data, true);
    },

    SubStore: function SubStore(store, path) {
        this._store = store;
        this._path = path;
    }
};

JsonStore.prototype.SubStore.prototype = {
    fill: function(path, data) {
        return this._store.fill(this._path + "." + path, data);
    },

    set: function(path, value) {
        var p = this._path;
        return this._store.set(path == null ? p : p + "." + path, value);
    },

    sub: function(path, callback, handle) {
        var p = this._path, l = p.length;
        return this._store.sub(path == null ? p : p + "." + path, callback, handle, l + 1);
    },

    unsub: function(path, callback) {
        var p = this._path;
        return this._store.unsub(path == null ? p : p + "." + path, callback);
    },

    update: function(path, data) {
        var p = this._path;
        return this._store.update(path == null ? p : p + "." + path, data);
    }
};
