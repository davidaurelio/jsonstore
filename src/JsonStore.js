function JsonStore() {
    this._data = {};
    this._subscriptions = {};
}

JsonStore.prototype = {
    _clone: function _clone(obj) {
        if (obj !== null && typeof obj === "object") {
            if (obj instanceof Array) {
                var cloned = [];
                for (var i = 0, len = obj.length; i < len; i++) {
                    cloned[i] = _clone(obj[i]);
                }
                return cloned;
            }

            var cloned = {};
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = _clone(obj[key]);
                }
            }
            return cloned;
        }
        return obj;
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

    _keys: (Object.keys ?
        Object.keys :
        function _keys(obj) {
            var keys = [], i = 0;
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    keys[i++] = key;
                }
            }
            return keys;
        }
    ),

    _notify: function _notify(subtree, exact) {
        return;
        var clone = this._clone, path, data, callbacks, children;

        var specs = [];
        for (var i = 0, len = subtree && subtree.length; i < len; i++) {
            specs[i] = this._getSubscriptions(subtree[i]);
        }

        var s;
        while ((s = specs.shift())) {

        }

        for (i = 0, len = exact; i < len; i++) {
            path = exact[i];
            var callbacks = this._getSubscriptions(path)[0];
            data = this._get(path);
            for (var j = 0, lenJ = callbacks && callbacks.length; j < lenJ; j++) {
                callbacks[j](clone(data));
            }
        }
    },

    _update: function _update(toObj, toKey, from, path, notifications) {
        var to = toObj[toKey];

        if (to instanceof Array && from instanceof Array) {
            toObj[toKey] = to.concat(from);
            notifications.exact.push(path);
        }
        else if (from !== null && to !== null && typeof to == "object" && typeof from == "object") {
            for (var key in from) {
                if (from.hasOwnProperty(key)) {
                    _update(to, key, from[key], path + "." + key, notifications)
                }
            }
        }
        else {
            toObj[toKey] = from;
            notifications.subtree.push(path);
        }
    },

    set: function set(path, value) {
        var dir = path.split("."), key = dir.pop();
        dir = dir.length ? dir.join(".") : null;
        this._get(dir, true)[key] = this._clone(value);
        this._notify([path]);
    },

    subscribe: function subscribe(path, callback) {
        var subscriptions = this._subscriptions, undef;

        var segments = path.split("."), currentPath = path, lastSegment;
        while (segments.length && !subscriptions.hasOwnProperty(currentPath)) {
            subscriptions[currentPath] = {
                callbacks: [],
                children: lastSegment ? [lastSegment] : []
            };

            lastSegment = segments.pop();
            currentPath = segments.join(".");
        }

        if (lastSegment != null && segments.length) {
            var children = subscriptions[currentPath].children;
            if (children.indexOf(lastSegment) === -1) {
                children.push(lastSegment);
            }
        }

        var callbacks = subscriptions[path].callbacks;
        if (callbacks.indexOf(callback) === -1) {
            callbacks.push(callback);
        }
    },

    unsubscribe: function unsubscribe(path, callback) {
        var subscription = this._subscriptions[path];
        var callbacks = subscription && subscription.callbacks;
        var idx = callbacks && callbacks.indexOf(callback) || -1;
        if (idx !== -1) {
            callbacks.splice(idx, 1);
        }
    },

    update: function update(path, data) {
        var keys = this._keys;
        data = this._clone(data);

        var dir = path.split("."), key = dir.pop();
        dir = dir.length ? dir.join(".") : null;
        var queue = [], spec = [this._get(dir, true), key, data, path];

        var notify = [], notifySubtree = [];

        do {
            var toObj = spec[0], toKey = spec[1], from = spec[2];
            var to = toObj[toKey], currentPath = spec[3];

            if (to instanceof Array && from instanceof Array) {
                toObj[toKey] = to.concat(from);
                notify.push(currentPath);
            }
            else if (from !== null && to !== null && typeof to == "object" && typeof from == "object") {
                var properties = keys(from);
                for (var i = 0, len = properties.length; i < len; i++) {
                    var p = properties[i];
                    queue.push([to, p, from[p], currentPath + "." + p]);
                }
                notify.push(currentPath);
            }
            else {
                toObj[toKey] = from;
                notifySubtree.push(currentPath);
            }
        } while ((spec = queue.shift()));

        this._notify(notifySubtree, notify);
    },

    update2: function update2(path, data) {
        data = this._clone(data);
        var dir = path.split("."), key = dir.pop();
        dir = dir.length ? dir.join(".") : null;

        var notifications = {exact: [], subtree: []};
        this._update(this._get(dir, true), key, data, path, notifications);
    }
};
