function JsonStore() {
    this._data = {};
    this._subscriptions = {};
}

JsonStore.prototype = {
    _clone: function(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    _get: function(path, create) {
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
        function(obj) {
            var keys = [], i = 0;
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    keys[i++] = key;
                }
            }
            return keys;
        }
    ),

    _notify: function(subtree, exact) {
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

    set: function(path, value) {
        var dir = path.split("."), key = dir.pop();
        dir = dir.length ? dir.join(".") : null;
        this._get(dir, true)[key] = this._clone(value);
        this._notify([path]);
    },

    subscribe: function(path, callback) {
        var subscriptions = this._subscriptions, undef;

        var segments = path.split("."), currentPath = path, lastSegment;
        var created;
        while (!subscriptions.hasOwnProperty(currentPath)) {
            created = true;
            subscriptions[currentPath] = {
                callbacks: [],
                children: lastSegment ? [lastSegment] : []
            };

            lastSegment = segments.pop();
            currentPath = segments.join(".");
        }

        if (created && segments.length) {
            lastSegment = segments.pop();
            currentPath = segments.join(".");
            subscriptions[currentPath].children.push(lastSegment);
        }

        subscriptions[path].callbacks.push(callback);
    },

    unsubscribe: function(path, callback) {
        var callbacks = this._getCallbacks(path)[0];
        if (!callbacks) { return false; }

        var i = callbacks.indexOf(callback);
        if (i === -1) { return false; }

        callbacks.splice(i, 1);
        return true;
    },

    update: function(path, data) {
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
    }
};
