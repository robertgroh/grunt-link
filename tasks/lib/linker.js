"use strict";


module.exports = function (grunt, options) {


    var util = require("util"),
        path = require("path"),
        fs = require("fs"),
        _ = require("underscore"),
        comb = require("comb"),
        //npm = require("npm"),
        shell = require("execSync"),

        linkDependencies = Array.isArray(options.linkDependencies) ? options.linkDependencies
                                                                  : [ options.linkDependencies ],

        helper = require("./link_helper")(options.dir || process.cwd()),
        getPackageName = helper.getPackageName,
        shouldLink = helper.shouldLink,
        normalizeName = helper.normalizeName,
        isBoolean = comb.isBoolean,
        execP = comb.wrap(require("child_process").exec),
        rimraf = comb.wrap(require("rimraf")),
        log = grunt.log,
        verbose = grunt.verbose,
        sortedDeps = helper.findSortAndNormalizeDeps(linkDependencies),
        cyclic = sortedDeps.cyclic,
        errors = [],
        cwd = process.cwd();

    function mkDirP(dirPath){
        //FIXME this is no mkdir -p!
        fs.mkdir(dirPath, function mkDirErrorHandling(e) {
            if(e) {
                if (e.code !== 'EEXIST') {
                    throw e;
                } else {
                    grunt.log.debug('already exists: ' + path.resolve(dirPath));
                }
            }
        });
    }

    function link(target, linkName, options) {
        options = _.defaults(options, {dep: null, force: false});
        if(options.dep){
            verbose.write(options.dep + '. ');
        }
        grunt.log.debug('cwd: ' + process.cwd() +
                        (options.dep ? ' - link dep (' + options.dep + '): '
                                    : ' - create link: ') +
                        linkName + ' -> ' + target);
        try{
            fs.symlinkSync(target, linkName, 'junction');
        } catch(error) {
            if(options.force && error.code === 'EEXIST') {
                rimraf(linkName).chain(function linkDepsClean() {
                    fs.symlinkSync(target, linkName, 'junction');
                });
            } else {
                throw error;
            }
        }
    }

    function exec(cmds) {
        var result;

        if (!comb.isArray(cmds)) {
            cmds = [cmds];
        }
        return comb.async.array(cmds).forEach(function execLoop(cmd) {
            if (cmd) {
                if (typeof(cmd) === 'function'){
                    verbose.write(util.format("Executing %s ", cmd.name));
                    result = cmd();
                    verbose.ok();
                } else {
                    //cmd is String!?
                    verbose.ok(util.format("Executing %s.", cmd));
                    result = shell.exec(cmd);
                }
            }
            return result;
        }, 1);
    }


    if (cyclic.length && !options.ignoreCyclic) {
        errors.push(["Cyclic dependency detected please check your dependency graph."]);
        cyclic.forEach(function (cyc) {
            errors.push(util.format("%s => %s", cyc.pkg, cyc.deps.join(" ")));
        });
        return new comb.Promise().errback(new Error(errors.join("\n")));
    }

    log.subhead("Linking packages");
    return comb.async.array(sortedDeps.links).forEach(function (pkg) {
        try {
            var cmds = [],
                location = pkg[0],
                deps = pkg[1],
                install = isBoolean(pkg[2]) ? pkg[2] : true,
                loc = path.resolve(cwd, normalizeName(location));
            log.subhead("Linking " + getPackageName(loc));
            process.chdir(loc);
            if (deps.length) {
                cmds.push(function mkNodeModules(){
                    mkDirP('node_modules');
                });
                deps.forEach(function loop(dep){
                    cmds.push(function linkDeps(){
                        link(path.join(options.prefix, dep), //target
                             path.join('node_modules', dep), //linkName
                             {'dep': dep, 'force': true});
                    });
                });
                //cmds.push("npm link " + deps.join(" "));
            }
            if (options.install && install) {
                cmds.push("npm install");
            }
            if (shouldLink(location)) {
                cmds.push(function mkPrefix(){
                    mkDirP(options.prefix);
                });
                cmds.push(function createLink(){
                    link(loc, //target
                         path.join(options.prefix, getPackageName(loc)), //linkName
                         {'force': true});
                });
                //cmds.push("npm link");
            }
            if (install) {
                return options.clean ? rimraf(path.resolve(loc, "./node_modules")).chain(function () {
                    return exec(cmds);
                }) : exec(cmds);
            } else {
                return exec(cmds);
            }
        } catch (e) {
            console.log(e.stack);
            throw e;
        }
    }, 1);

};


