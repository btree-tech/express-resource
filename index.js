
/*!
 * Express - Resource
 * Copyright(c) 2010-2012 TJ Holowaychuk <tj@vision-media.ca>
 * Copyright(c) 2011 Daniel Gasienica <daniel@gasienica.ch>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var methods = require('methods')
  , pluralize = require('pluralize');

/**
 * Pre-defined action ordering.
 */

var orderedActions = [
   'index'    //  GET     /
  , 'new'     //  GET     /new
  , 'create'  //  POST    /
  , 'show'    //  GET     /:id
  , 'edit'    //  GET     /edit/:id
  , 'update'  //  PUT     /:id
  , 'patch'   //  PATCH   /:id
  , 'destroy' //  DELETE  /:id
];

/**
 * Expose `app`.
 */

exports = module.exports = function(app) {
  app.resource = resource.bind(app);
  return app;
};

/**
 * Define a resource with the given `name` and `actions`.
 *
 * @param {String|Object} name or actions
 * @param {Object} actions
 * @return {Resource}
 * @api public
 */
function resource(name, actions, opts){
  var options = actions || {};
  if ('object' === typeof name) {
    actions = name;
    name = null;
  }
  if (options.id) actions.id = options.id;
  for (var key in opts) options[key] = opts[key];
  return new Resource(name, actions, this);
}

/**
 * Initialize a new `Resource` with the given `name` and `actions`.
 *
 * @param {String} name
 * @param {Object} actions
 * @param {Server} app
 * @api private
 */

exports.Resource = Resource;

function Resource(name, actions, app) {
  actions = actions || {};

  this.name = name;
  this.routes = {};
  this.app = app;
  this.base = actions.base || '/';
  if ('/' !== this.base[this.base.length - 1]) this.base += '/';
  this.format = actions.format;
  this.id = actions.id || this.defaultId;
  this.param = ':' + this.id;

  // default actions
  for (var i = 0, key; i < orderedActions.length; ++i) {
    key = orderedActions[i];
    if (actions[key]) this.mapDefaultAction(key, actions[key]);
  }

  // auto-loader
  if (actions.load) this.load(actions.load);
}

/**
 * Set the auto-load `fn`.
 *
 * @param {Function} fn
 * @return {Resource} for chaining
 * @api public
 */

Resource.prototype.load = function(fn){
  var self = this
    , id = this.id;

  this.app.param(this.id, function(req, res, next){
    function callback(err, obj){
      if (err) return next(err);
      // TODO: ideally we should next() passed the
      // route handler
      if (typeof obj === 'undefined' || obj === null) return res.sendStatus(404);
      req[id] = obj;
      next();
    }

    // Maintain backward compatibility
    if (2 === fn.length) {
      fn(req.params[id], callback);
    } else {
      fn(req, req.params[id], callback);
    }
  });

  return this;
};

/**
 * Retun this resource's default id string.
 *
 * @return {String}
 * @api private
 */

Resource.prototype.__defineGetter__('defaultId', function(){
  return this.name ? pluralize(this.name.split('/').pop(), 1) : 'id';
});

/**
 * Map http `method` and optional `path` to `fn`.
 *
 * @param {String} method
 * @param {String|Function|Object} path
 * @param {Function} fn
 * @return {Resource} for chaining
 * @api public
 */

Resource.prototype.map = function(method, path, fn){
  var self = this
    , orig = path;

  if ('function' === typeof path || 'object' === typeof path) {
    fn = path;
    path = '';
  }
  if (path && '/' === path[0]) path = path.substr(1);
  else path = path ? this.param + '/' + path : this.param;
  method = method.toLowerCase();

  // setup route pathname
  var route = this.base + (this.name || '');
  if (this.name && path) route += '/';
  route += path;
  route += '.:format?';

  // apply the route
  this.app[method](route, function(req, res, next){
    req.format = req.params.format || req.format || self.format;
    if (req.format) res.type(req.format);
    if ('object' === typeof fn) {
      if (fn[req.format]) {
        fn[req.format](req, res, next);
      } else {
        res.format(fn);
      }
    } else {
      fn(req, res, next);
    }
  });

  return this;
};

/**
 * Nest the given `resource`.
 *
 * @param {String|Object} name or actions
 * @param {Object} actions
 * @return {Resource} for chaining
 * @api public
 */

Resource.prototype.add = function(name, actions, opts){
  // relative base
  var base = this.base
    + (this.name ? this.name + '/': '')
    + this.param + '/';

  var options = actions || {};

  actions.base = base;

  if (options.id) actions.id = options.id;
  for (var key in opts) options[key] = opts[key];

  // create new resource.
  new Resource(name, actions, this.app);

  return this;
};

/**
 * Map the given action `name` with a callback `fn()`.
 *
 * @param {String} key
 * @param {Function} fn
 * @api private
 */

Resource.prototype.mapDefaultAction = function(key, fn){
  switch (key) {
    case 'index':
      this.get('/', fn);
      break;
    case 'new':
      this.get('/new', fn);
      break;
    case 'create':
      this.post('/', fn);
      break;
    case 'show':
      this.get(fn);
      break;
    case 'edit':
      this.get('edit', fn);
      break;
    case 'update':
      this.put(fn);
      break;
    case 'patch':
      this.patch(fn);
      break;
    case 'destroy':
      this.delete(fn);
      break;
  }
};

/**
 * Setup http verb methods.
 */

methods.concat(['delete', 'all']).forEach(function(method){
  Resource.prototype[method] = function(path, fn){
    if ('function' === typeof path || 'object' === typeof path) {
      fn = path;
      path = '';
    }
    this.map(method, path, fn);
    return this;
  }
});
