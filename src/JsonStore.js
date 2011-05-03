function JsonStore() {
    this._data = {};
    this._subscriptions = {};
}

JsonStore.prototype = {
    SubStore: function SubStore(store, path) {
        this._store = store;
        this._path = "." + path;
    },

    _clone: function _clone(obj) {
        return _clone.cloneObj({o: obj}).o;
    },

    _defer: function(func, param) {
        setTimeout(function() { func(param); }, 0);
    },

    _get: function _get(path, create) {
        if (path == null) { return this._data; }
        var segments = path.split("."), current = this._data;
        for (var i = 0, len = path.length; i < len; i++) {
            var last = current, s = segments[i];
            current = current[s];
            if (typeof current !== "object" || current === null) {
                if (create) { current = last[s] = {}; }
                else { break; }
            }
        }

        return current;
    },

    _invokeCallbacks: function(callbacks, dataPath, eventPath) {
        if (!callbacks || !callbacks.length) { return; }
        eventPath || (eventPath = dataPath);
        var data = this._get(data), clone = this._clone, defer = this._defer;
        for (var i = 0, callback; (callback = callbacks[j]); j += 2) {
            defer(callback, {
                path: eventPath.slice(callbacks[j+1]),
                data: clone(data)
            });
    }
    },

    _notify: function _notify(withSubtree, parentsOf, withoutSubtree) {
        var notified = [];

        // The queue contains the paths without subtree notifiying first and
        // paths with subtree notifying last
        var queue = withoutSubtree;
        queue = queue && withSubtree ?
                queue.concat(withSubtree) :
                withSubtree;

        // in the queue, indexes >= (length of paths without subtree) need their
        // subtrees to be notified
        var withoutSubtreeLen = withoutSubtree.length || 0;

        var subscriptions = this._subscriptions;
        if (queue) {
            // notify each queued path
            var initialLength = queue.length;
            for (var path, i = 0; (path = queue.shift()) !== null; i++) {
                // get subscriptions for path
                var subs = subscriptions[currentPath];
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
        }
    },

    getSubStore: function(path) {
        return new this.SubStore(this, path);
    },

    set: function set(path, value) {
        var dir = path.split("."), key = dir.pop();
        dir = dir.length ? dir.join(".") : null;

        var currentData = this._get(dir, true);
        var notifications = [];
        notifications[currentData[key] instanceof Object ? 0 : 1] = path;
        currentData[key] = this._clone(value);

        this._notify(notifications[0], path, notifications[1]);
    },

    subscribe: function subscribe(path, callback, _cutLeadingChars) {
        if (typeof callback !== "function") {
            throw Error("Only functions supported");
        }
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
        if (callbacks.indexOf(callback) === -1) {
            callbacks.push(callback, _cutLeadingChars);
        }

        var data = this._clone(this._get(path));
        setTimeout(function() { callback(data) }, 0);
    },

    unsubscribe: function unsubscribe(path, callback) {
        if (typeof callback !== "function") {
            throw Error("Only functions supported");
        }
        var subscription = this._subscriptions[path];
        var callbacks = subscription && subscription.callbacks;
        var idx = callbacks && callbacks.indexOf(callback) || -1;
        if (idx !== -1) {
            callbacks.splice(idx, 2);
        }
    },

    update: function update(path, data) {
        var A = Array, O = Object;
        data = this._clone(data);

        var dir = path.split("."), key = dir.pop();
        dir = dir.length ? dir.join(".") : null;
        var queue = [], spec = [this._get(dir, true), key, data, path];

        var notify = [], notifySubtree = [];

        do {
            var toObj = spec[0], toKey = spec[1], from = spec[2];
            var to = toObj[toKey], currentPath = spec[3];

            if (to instanceof A && from instanceof A) {
                toObj[toKey] = to.concat(from);
                notify.push(currentPath);
            }
            else if (to instanceof O && from instanceof O) {
                for (var p in from) {
                    if (from.hasOwnProperty(p)) {
                        queue.push([to, p, from[p], currentPath + "." + p]);
                    }
                }
                notify.push(currentPath);
            }
            else {
                toObj[toKey] = from;
                (to instanceof O ? notifySubtree : notify).push(currentPath);
            }
        } while ((spec = queue.shift()));

        this._notify(notifySubtree, path, notify);
    }
};

/**
 * Clones an object with `obj instanceof Object`.
 *
 * @param {Object} obj
 * @returns {Object} An object cloned from obj
 */
JsonStore.prototype._clone.cloneObj = function cloneObj(obj) {
    var O = Object;
    if (obj instanceof Array) {
        var theClone = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            var value = obj[i];
            theClone[i] = value instanceof O ? cloneObj(value) : value;
        }
    }
    else {
        var theClone = {};
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                var value = obj[key];
                theClone[key] = value instanceof O ? cloneObj(value) : value;
            }
        }
    }
    return theClone;
};

JsonStore.prototype.SubStore.prototype = {
    set: function(path, value) {
        return this._store.set(this._path + path, value);
    },

    subscribe: function(path, callback) {
        var p = this._path, l = p.length;
        return this._store.subscribe(p + path, callback, l);
    },

    unsubscribe: function(path, callback) {
        return this._store.unsubscribe(this._path + path, callback);
    },

    update: function(path, data) {
        return this._store.update(this._path + path, data);
    }
};
