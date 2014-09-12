/**
 * Module dependencies
 */

var dir = require('fs').readdirSync;
var now = require('performance-now');
var CoreMap = require('directiv-core-map');
var should = require('should');

exports.directive = function(name, mod, stores, path, iterations) {
  var root = path + '/cases';
  iterations = iterations || 10000;

  var cases = dir(root).map(function(name) {
    var testRoot = root + '/' + name;
    return {
      name: name,
      input: require(testRoot + '/in'),
      output: require(testRoot + '/out')
    };
  });

  var injector = function(name) {
    return stores[name];
  };

  describe(name, function() {
    describe('cases', function() {
      cases.forEach(function(test) {
        it('should ' + test.name, function() {
          var config = mod.compile(test.input.props[name] || '');
          var state = new CoreMap(test.input.state);
          var newState = mod.state.call(injector, config, state);
          if (newState !== false) state = newState;

          // props
          var props = new CoreMap();
          if (mod.props) props = mod.props(config, state, props);

          // children
          var children = (test.input.children || []).map(function(child) {
            return new CoreMap(child);
          });
          var newChildren = (mod.children || function(){return children}).call(injector, config, state, children);
          if (typeof newChildren === 'string') newChildren = [newChildren];


          var el = {
            tag: test.input.tag, // TODO call the tag function
            state: state.get(),
            children: newChildren.map(function(child) {
              if (typeof child === 'string') return child;
              var c = child.get();
              c.state = c.state.get();
              return c;
            }),
            props: props.get()
          };
          el.should.eql(test.output);
        });
      });
    });

    if (process.env.DISABLE_BENCHMARKS) return;

    describe('benchmarks', function() {
      if (mod.compile) {
        describe('compile', function() {
          var compiles = cases.map(function(test) {
            return mod.compile.bind(injector, test.input.props[name] || '');
          });
          benchmark(iterations, compiles);
        });
      }

      if (mod.state) {
        describe('state', function() {
          var states = cases.map(function(test) {
            var config = mod.compile(test.input.props[name] || '');
            var state = new CoreMap(test.input.state);
            return mod.state.bind(injector, config, state);
          });
          benchmark(iterations, states);
        });
      }

      if (mod.props) {
        describe('props', function() {
          var props = cases.map(function(test) {
            var config = mod.compile(test.input.props[name] || '');
            var state = new CoreMap(test.input.state);
            var newState = mod.state.call(injector, config, state);
            if (newState === false) newState = state;
            return mod.props.bind(injector, config, state, test.input.props);
          });
          benchmark(iterations, props);
        });
      }

      if (mod.children) {
        describe('children', function() {
          var children = cases.map(function(test) {
            var config = mod.compile(test.input.props[name] || '');
            var state = new CoreMap(test.input.state);
            var newState = mod.state.call(injector, config, state);
            if (newState === false) newState = state;
            return mod.children.bind(injector, config, state, test.input.children);
          });
          benchmark(iterations, children);
        });
      }
    });
  });
};

function benchmark(iterations, cases) {
  var length = cases.length;
  var count = iterations / length;
  var c, i;
  var start = now();
  for (c = 0; c < count; c++) {
    for (i = 0; i < length; i++) {
      cases[i]();
    }
  }
  var end = now();
  print(iterations, start, end);
}

function print(iterations, start, end) {
  var seconds = (end - start) / 1000;
  var ops = prettyNumber(iterations / seconds);
  it(ops + ' ops/s', function() {});
}

function prettyNumber(x) {
  return Math.floor(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
