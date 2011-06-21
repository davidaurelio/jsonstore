var salt = {};
/**
 * @param {Function} f The function to defer
 * @param {Array|Arguments} [args] Arguments to apply to the function
 * @param {Object} [context] The context to execute the function in
 */
salt.defer = function(f, args, context) {
    setTimeout(args || context ? function() { f.apply(context, args); } : f, 0);
};
/**
 * @param {Object} obj The object to clone.
 * @returns {Object} A deep clone of `obj`.
 */
salt.clone = function clone(obj) {
    var O = Object;
    if (obj instanceof Array) {
        var theClone = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            var value = obj[i];
            theClone[i] = value instanceof O ? clone(value) : value;
        }
    }
    else if (obj instanceof O) {
        var theClone = {};
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                var value = obj[key];
                theClone[key] = value instanceof O ? clone(value) : value;
            }
        }
    }
    else {
        theClone = obj;
    }

    return theClone;
};
/**
 * Looks up a nested property and returns it if found.
 *
 * @param {Object} obj The lookup root object.
 * @param {string} keypath A string of property names separated by dots.
 * @param {bool} create Whether to create missing properties (as object).
 * @returns The value found at keypath, else undefined.
 */
salt.keypath = function(obj, keypath, create) {
    var keys = keypath.split(".");
    for (var i = 0, key; obj && (key = keys[i]) != null; i++) {
        var last = obj;
        if ((obj = last[key]) == null && create) {
            obj = last[key] = {};
        }
    }

    return obj;
};

