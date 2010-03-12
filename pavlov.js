/**
 * pavlov - Behavioral API over JavaScript Test Frameworks
 * 
 * version 0.3.0pre
 * 
 * http://michaelmonteleone.net/projects/pavlov
 * http://github.com/mmonteleone/pavlov
 *
 * Copyright (c) 2010 Michael Monteleone
 * Licensed under terms of the MIT License (README.markdown)
 */
(function(){
    // capture reference to global scope 
    var globalScope = this;
    
    // ===========
    // = Helpers =
    // ===========
    
    // Trimmed versions of jQuery helpers for use only within pavlov
    
    /**
     * Iterates over an object or array
     * @param {Object|Array} object object or array to iterate
     * @param {Function} callback callback for each iterated item
     */
    var each = function(object, callback) {
        var name,
            i = 0,
            length = object.length;

        if ( length === undefined ) {
            for ( name in object ) {
                if ( callback.call( object[ name ], name, object[ name ] ) === false ) {
                    break;
                }
            }
        } else {
            for ( var value = object[0];
                i < length && callback.call( value, i, value ) !== false; 
                value = object[++i] ) {}
        }

        return object;        
    };
    
    /**
     * converts an array-like object to an array
     * @param {Object} array array-like object
     * @returns array
     */
    var makeArray = function(array) {
        var ret = [],
            i = array.length;
        while( i ) { ret[--i] = array[i]; }         
        
        return ret;        
    };
    
    /**
     * returns whether or not an object is an array
     * @param {Object} obj object to test
     * @returns whether or not object is array
     */
    var isArray = function(obj) {
        return Object.prototype.toString.call(obj) === "[object Array]";        
    };
    
    /**
     * merges properties form one object to another
     * @param {Object} dest object to receive merged properties
     * @param {Object} src object containing properies to merge
     */
    var extend = function(dest, src) {
        for(var prop in src) {
            dest[prop] = src[prop];
        }        
    };
        
        
    // ====================
    // = Example Building =
    // ====================

    var examples = [],
        currentExample;

    /**
     * Example Class
     * Represents an instance of an example (a describe)
     * contains references to parent and nested examples
     * exposes methods for returning combined lists of before, after, and names
     * @constructor
     * @param {example} parent example to append self as child to (optional)
     */    
    function example(parent) {
        // private

        if(parent) {
            // if there's a parent, append self as nested example
            parent.children.push(this);
        } else {
            // otherwise, add this as a new root example
            examples.push(this);
        }

        var thisExample = this;        

        /**
         * Rolls up list of current and ancestors values for given prop name
         * @param {String} prop Name of property to roll up
         * @returns array of values corresponding to prop name
         */
        var rollup = function(prop) {
            var items = [];
            var node = thisExample;
            while(node !== null) {
                items.push(node[prop]);
                node = node.parent;
            }
            return items;
        };

        // public
        
        // parent example
        this.parent = parent ? parent : null;
        // nested examples
        this.children = [];
        // name of this description
        this.name = '';
        // function to happen before all contained specs
        this.before = function() {};
        // function to happen after all contained specs
        this.after = function() {};
        // array of it() tests
        this.specs = [];

        /**
         * rolls up this and ancestor's before functions
         * @returns arrayt of functions                  
         */
        this.befores = function(){
            return rollup('before').reverse();
        };
        /**
         * Rolls up this and ancestor's after functions
         * @returns array of functions
         */
        this.afters = function(){
            return rollup('after');
        };
        /**
         * Rolls up this and ancestor's description names, joined 
         * @returns string of joined description names
         */
        this.names = function(){
            return rollup('name').reverse().join(', ');     
        };
    }
    


    // ==============
    // = Assertions =
    // ==============  
    
    var assertions = {
        equals: function(actual, expected, message) {
            adapter.assert(actual == expected, message);
        },
        isEqualTo: function(actual, expected, message) {
            adapter.assert(actual == expected, message);
        },
        isNotEqualTo: function(actual, expected, message) {
            adapter.assert(actual != expected, message);
        },
        isTrue: function(actual, message) {     
            adapter.assert(actual, message);
        },
        isFalse: function(actual, message) {            
            adapter.assert(!actual, message);
        },
        isNull: function(actual, message) {
            adapter.assert(actual === null, message);
        },
        isNotNull: function(actual, message) {            
            adapter.assert(actual !== null, message);
        },
        isDefined: function(actual, message) {
            adapter.assert(typeof actual !== 'undefined', message);
        },
        isUndefined: function(actual, message) {
            adapter.assert(typeof actual === 'undefined', message);
        },
        pass: function(actual, message) {
            adapter.assert(true, message);
        },
        fail: function(actual, message) {
            adapter.assert(!true, message);
        },
        throwsException: function(actual, expectedErrorDescription, message) {
            /* can optionally accept expected error message */
            try{
                actual();
                adapter.assert(!true, message);
            } catch(e) {
                if(arguments.length > 1) {
                    adapter.assert(e === expectedErrorDescription, message);                        
                } else {
                    adapter.assert(true, message);                        
                }
            }                               
        }
    };

    /**
     * AssertionHandler
     * represents instance of an assertion regarding a particular 
     * actual value, and provides an api around asserting that value
     * against any of the bundled assertion handlers and custom ones.
     * @constructor
     * @param {Object} value A test-produced value to assert against
     */
    var assertHandler = function(value) {
        this.value = value;
    };
    /**
     * Appends assertion methods to the assertHandler prototype
     * For each provided assertion implementation, adds an identically named
     * assertion function to assertionHandler prototype which can run impl
     * @param {Object} asserts Object containing assertion implementations
     */
    var addAssertions = function(asserts) {
        each(asserts, function(name, fn){
            assertHandler.prototype[name] = function() {
                // implement this handler against backend
                // by pre-pending assertHandler's current value to args
                var args =  makeArray(arguments);
                args.unshift(this.value);           
                fn.apply(this, args);
            };
        }); 
    };
    addAssertions(assertions);


    // =====================
    // = pavlov Public API =
    // =====================


    /**
     * Object containing methods to be made available as public API
     */
    var api = {
        /**
         * Initiates a new Example context
         * @param {String} description Name of what's being "described"
         * @param {Function} fn Function containing description (before, after, specs, nested examples)
         */
        describe: function(description, fn) {
            if(arguments.length < 2) {
                throw "both 'description' and 'fn' arguments are required";
            }
            
            // capture reference to current example before construction
            var originalExample = currentExample;
            try{
                // create new current example for construction
                currentExample = new example(currentExample);
                currentExample.name = description;
                fn();        
            } finally {
                // restore original reference after construction
                currentExample = originalExample;
            }
        }, 

        /**
         * Sets a function to occur before all contained specs and nested examples' specs
         * @param {Function} fn Function to be executed         
         */
        before: function(fn) {
            if(arguments.length === 0) {
                throw "'fn' argument is required";
            }
            currentExample.before = fn;
        },
        
        /**
         * Sets a function to occur after all contained tests and nested examples' tests
         * @param {Function} fn Function to be executed         
         */
        after: function(fn) {
            if(arguments.length === 0) {
                throw "'fn' argument is required";
            }
            currentExample.after = fn;
        },
        
        /**
         * Creates a spec (test) to occur within an example
         * When not passed fn, creates a spec-stubbing fn which asserts fail "Not Implemented"
         * @param {String} specification Description of what "it" "should do"
         * @param {Function} fn Function containing a test to assert that it does indeed do it (optional)
         */
        it: function(specification, fn) {
            if(arguments.length === 0) {
                throw "'specification' argument is required";
            }
            thisApi = this;
            if(fn) {
                currentExample.specs.push([specification, fn]);
            } else {
                // if not passed an implementation, create an implementation that simply asserts fail
                thisApi.it(specification, function(){thisApi.assert.fail('Not Implemented');});
            }
        },

        /**
         * Generates a row spec for each argument passed, applying 
         * each argument to a new call against the spec
         * @returns an object with an it() function for defining 
         * function to be called for each of given's arguments
         * @param {Array} arguments either list of values or list of arrays of values
         */
        given: function() {
            if(arguments.length === 0) {
                throw "at least one argument is required";
            }
            var args = makeArray(arguments),
                thisIt = this.it;

            return {
                /**
                 * Defines a row spec (test) which is applied against each
                 * of the given's arguments.
                 */
                it: function(specification, fn) {
                    each(args, function(){                        
                        var arg = this;   
                        thisIt("given " + arg + ", " + specification, function(){ 
                            fn.apply(this, isArray(arg) ? arg : [arg]);
                        });
                    });
                }
            };
        },
        
        /**
         * Assert a value against any of the bundled or custom assertions
         * @param {Object} value A value to be asserted
         * @returns an assertHandler instance to fluently perform an assertion with
         */
        assert: function(value) {
            return new assertHandler(value);
        },
        
        wait: function(ms, fn) {
            if(arguments.length < 2) {
                throw "both 'ms' and 'fn' arguments are required";
            }            
            adapter.wait(ms, fn);
        }
    };

    // extend api's assert function for easier syntax for blank pass and fail
    extend(api.assert, {
        /**
         * Shortcuts assert().pass() with assert.pass()
         * @param {String} message Assertion message (optional)
         */
        pass: function(message){
            (new assertHandler()).pass(message);
        },
        /**
         * Shortcuts assert().fail() with assert.fail()
         * @param {String} message Assertion message (optional)
         */
        fail: function(message){
            (new assertHandler()).fail(message);
        }
    });

    /**
     * Extends a function's scope
     * applies the extra scope to the function returns un-run new version of fn
     * inspired by Yehuda Katz's metaprogramming Screw.Unit
     * different in that new function can still accept all parameters original function could
     * @param {Function} fn Target function for extending
     * @param {Object} thisArg Object for the function's "this" to refer
     * @param {Object} extraScope object whose members will be added to fn's scope
     * @returns Modified version of original function with extra scope.  Can still 
     * accept parameters of original function
     */
    var extendScope = function(fn, thisArg, extraScope) {

        // get a string of the fn's parameters
        var params = fn.toString().match(/\(([^\)]*)\)/)[1];
        // get a string of fn's body
        var source = fn.toString().match(/^[^\{]*\{((.*\n*)*)\}/m)[1];

        // create a new function with same parameters and
        // body wrapped in a with(extraScope){ }
        fn = new Function(
            "extraScope" + (params ?  ", " + params : ""), 
            "with(extraScope){" + source + "}");
        
        // returns a fn wrapper which takes passed args, 
        // pre-pends extraScope arg, and applies to modified fn
        return function(){ 
            var args = [extraScope];
            each(arguments,function(){
                args.push(this);
            });
            fn.apply(thisArg, args);
        };
    };

    /**
     * Top-level Specify method.  Declares a new pavlov context
     * @param {String} name Name of what's being specified
     * @param {Function} fn Function containing exmaples and specs     
     */
    var specify = function(name, fn) {
        if(arguments.length < 2) {
            throw "both 'name' and 'fn' arguments are required";
        }
        examples = [];
        currentExample = null;

        // set the test suite title
        name += " Specifications";
        
        // run the adapter initiation
        adapter.initiate(name);

        if(specify.globalApi) { 
            // if set to extend global api, 
            // extend global api and run example builder
            extend(globalScope, api);
            fn(); 
        } else { 
            // otherwise, extend example builder's scope with api
            // and run example builder
            extendScope(fn, this, api)(); 
        }

        // compile examples into an executable which runs tests in adapter's test framework
        var executable = adapter.compile(name, examples);
        
        // run the tests
        executable();
    };  

    // ====================================
    // = Test Framework Adapter Interface =
    // ====================================

    // abstracts functionality of underlying testing framework
    var adapter = {
        /**
         * adapter-specific initialization code
         * which is called once before any tests are run
         * @param {String} suiteName name of the pavlov suite name
         */
        initiate: function(suiteName) { },
        /**
         * specifies test runner to synchronously wait
         * @param {Number} ms Milliseconds to wait
         * @param {Function} fn Function to execute after ms has 
         * passed before resuming
         */
        wait: function(fn, ms) { 
            throw "'wait' not implemented by test framework adapter";            
        },
        /**
         * adapter-specific assertion method
         * @param {bool} expr Boolean expression to assert against
         * @param {String} message message to pass along with assertion
         */
        assert: function(expr, message) {
            throw "'assert' must be implemented by a test framework adapter";
        },
        /**
         * adapter-specific compilation method.  Translates a nested set of 
         * pre-constructed Pavlov example objects into a callable function which, when run
         * will execute the tests within the backedn test framework
         * @param {String} suiteName name of overall test suite
         * @param {Array} examples Array of example object instances, possibly nesteds
         */
        compile: function(suiteName, examples) {
            throw "'compile' must be implemented by a test framework adapter";
        }        
    };
            
    
    // =====================
    // = Expose Public API =
    // =====================

    // add global settings onto pavlov
    extend(specify, {
        version: '0.3.0pre',
        adapter: adapter,
        adapt: function(frameworkName, testFrameworkAdapter) {
            adapter.name = frameworkName;
            extend(adapter, testFrameworkAdapter);
        },
        util: {
            each: each,
            extend: extend
        },
        globalApi: false,                 // when true, adds api to global scope
        extendAssertions: addAssertions,  // function for adding custom assertions
        global: window              // injectable global containing setTimeout and pals
    });
    // expose the api as "pavlov"
    specify.global.pavlov = specify;

})();

