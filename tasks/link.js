"use strict";

/*
 * grunt-link
 * http://doug-martin.github.com/grunt-link
 *
 * Copyright (c) 2012 Doug Martin
 * Licensed under the MIT license.
 */

module.exports = function (grunt) {
    var linker = require("./lib/linker.js"),
        path = require("path");

    // Please see the grunt documentation for more information regarding task and
    // helper creation: https://github.com/gruntjs/grunt/blob/master/docs/toc.md

    // ==========================================================================
    // TASKS
    // ==========================================================================

    grunt.registerTask('link', 'Your task description goes here.', function () {
        //FIXME: use grunt.options()
        var options = grunt.util._.extend({ ignoreCyclic      : false,
                                              dir             : process.cwd(),
                                              install         : true,
                                              clean           : true,
                                              prefix          : path.resolve('./gruntlink_symlinks'),
                                              linkDependencies: []
                                          },
                                           grunt.config("link")),
            done,
            cwd;
        if (options.dir) {
            if (!Array.isArray(options.dir)) { options.dir = [ options.dir ]; }
            options.dir = options.dir.map(function absPath(dir) {
                return path.resolve(process.cwd(), dir);
            });
        }

        done = this.async();
        cwd = process.cwd();
        linker(grunt, options).classic(function (err) {
            process.chdir(cwd);
            if (err) {
                grunt.log.error("Error linking packages");
                grunt.log.error(err.stack);
                done(false);
            } else {
                done();
            }
        });
    });
};
