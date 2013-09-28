/**
 * @fileoverview Chain.
 * @author pho.nzp@gmail.com (Andrey Sorokin)
 * @license MIT.
 */



/**
 * @constructor
 */
function Chain(elements) {
  if (!(this instanceof Chain)) { return new Chain(elements); }
  this.$elements = elements || [];
  this.$listeners = [];
  this.$result = undefined;
  this.$results = [];
  this.$running = false;
}


/**
 * @enum {integer}
 */
Chain.type = {
  SYNC: 0,
  ASYNC: 1,
  CHAIN: 2
};


Chain.prototype.then = function(fns) {
  var i, element;

  if (!(fns instanceof Array)) { fns = [fns]; }

  for (i = 0; i < fns.length; i++) {
    element = {type: Chain.type.SYNC, fn: fns[i]};
    this.$elements.push(element);
  }

  return this;
};


Chain.prototype.defer = function(fns) {
  var i, element;

  if (!(fns instanceof Array)) { fns = [fns]; }

  for (i = 0; i < fns.length; i++) {
    element = {type: Chain.type.ASYNC, fn: fns[i]};
    this.$elements.push(element);
  }

  return this;
};


Chain.prototype.when = function(chains) {
  var element, elements = this.$elements,
      last = elements[elements.length - 1],
      CHAIN = Chain.type.CHAIN;

  if (!(chains instanceof Array)) { chains = [chains]; }

  for (i = 0; i < chains.length; i++) {
    last = elements[elements.length - 1];
    if ((last && last.type == CHAIN) || i > 0) {
      last.chains.push(chains[i]);
    } else {
      element = {type: CHAIN, chains: [chains[i]]};
      this.$elements.push(element);
    }
  }

  return this;
};


Chain.prototype.$callback = function(i, done) {
  var chain = this;

  return function(result) {
    chain.$result = result;
    chain.$next(i, done);
  }
};


/**
 */
Chain.handler = {};


Chain.handler[Chain.type.SYNC] = function(chain, element, i, done) {
  chain.$result = element.fn(chain.$result);
  chain.$next(i, done);
};


Chain.handler[Chain.type.ASYNC] = function(chain, element, i, done) {
  element.fn(chain.$result, chain.$callback(i, done));
};


Chain.handler[Chain.type.CHAIN] = function(chain, element, i, done) {
  var j, count = 0;

  function $done(j) {
    return function(result) {
      chain.$results[j] = result;
      if (++count === element.chains.length) {
        chain.$result = chain.$results;
        chain.$results = [];
        chain.$next(i, done);
      }
    };
  }

  if (chain.$result) { chain.$results.push(chain.$result); }

  for (j = 0; j < element.chains.length; j++) {
    element.chains[j].end($done(j));
  }
};


Chain.prototype.$done = function(done) {
  var i, result;

  if (this.$results.length && this.$result) {
    this.$results.push(this.$result);
    this.$result = this.$results;
    this.$results = [];
  }

  done(this.$result);
  this.$running = false;

  for (i = 0; i < this.$listeners.length; i++) {
    this.$listeners[i](this.$result);
  }
  this.$listeners = [];
};


Chain.prototype.$next = function(i, done) {
  var element = this.$elements[i], handler = this.constructor.handler;

  if (i++ >= this.$elements.length) { return this.$done(done); }

  handler[element.type](this, element, i, done);
};


Chain.prototype.$noop = function() {};


Chain.prototype.$run = function(fn) {
  var i = 0, chain = this;

  if (!fn || typeof fn != 'function') { fn = this.$noop; }

  if (this.$running) {
    this.$listeners.push(fn);
  } else {
    this.$running = true;
    this.$next(i, fn);
  }
};


Chain.prototype.end = function(fn, rerun) {
  var forceRun = rerun || this.$result === undefined;

  if (forceRun) { this.$run(fn); }
  else { fn(this.$result); }

  return this;
};

