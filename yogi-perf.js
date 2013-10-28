#!/usr/bin/env node

/*
Copyright (c) 2013, Yahoo! Inc. All rights reserved.
Code licensed under the BSD License:
http://yuilibrary.com/license/
*/

/*jshint latedef: false */
/*jshint maxlen: 300 */
var YOGI_PATH = process.env.YOGI_PATH;

if (!YOGI_PATH) {
    console.log('This should be executed from yogi');
    process.exit(1);
}

var async = require('async'),
    glob = require('glob'),
    spawn = require('win-spawn'),
    path = require('path'),
    args = require(path.join(YOGI_PATH, 'lib/args')),
    config = require(path.join(YOGI_PATH, 'lib/config')),
    git = require(path.join(YOGI_PATH, 'lib/git')),
    log = require(path.join(YOGI_PATH, 'lib/log')),
    util = require(path.join(YOGI_PATH, 'lib/util')),
    options;

// Add some additional arguments to the known options
args.known.ref = [String, Array];
args.known.working = Boolean;
args.known.autoexecute = Boolean;

options = args.parse();

config.init(options);

if (process.argv.indexOf('help') !== -1) {
    help();
}
else {
    init(options);
}

function help () {
    console.log(
        'Executes performance tests\n',
        '--loglevel <string> "info" or "debug". Default: info\n',
        '--ref <string> Which YUI ref you\'d like to execute the test against. Specify as many as you\'d like (each with its own --ref).\n',
        '--timeout <number> How long to wait (in seconds) before aborting this process. Default: 300\n',
        '--tmp <path> A path where temporary files can be stored. Default: OS assigned\n',
        '--working <boolean> Whether or not to include your working tree as a test ref. Default: true\n'
    );
}

function init (opts) {
    var options,
        yuiRoot,
        module,
        mod,
        component,
        testpaths;

    options = this.options = opts.parsed;
    yuiRoot = this.yuiRoot = path.join(git.findRoot(), '..');
    module = this.module = util.getPackage(true);
    mod = util.findModule(true);
    component = (options.component || (mod && mod.name));
    testpaths = glob.sync(path.join(yuiRoot, '/src/' + (component ? component : '*') + '/tests/performance/*.js'));

    executeTests(testpaths);
}

function executeTests (testpaths) {
    var options = this.options,
        yuiRoot = this.yuiRoot,
        loglevel = (options.loglevel || 'info'),
        tmp = (options.tmp || false),
        timeout = (options.timeout || 300),
        outdir = (options.outdir || false),
        refs = (options.ref || []),
        wip = (options.working === undefined ? true : options.working),
        cmd = path.join(__dirname, 'node_modules/.bin/yb'),
        args = [],
        rawpath;

    args = [
        '--repo=' + yuiRoot,
        '--loglevel=' + loglevel,
        '--working=' + wip,
        '--timeout=' + timeout,
        '--phantom=true',
        '--autoexecute=true'
    ];

    if (tmp) {
        args.push('--tmp=' + tmp);
    }

    refs.forEach(function(ref) {
        args.push('--ref=' + ref);
    });

    log.info('Found ' + testpaths.length + ' test file' + (testpaths.length > 1 ? 's' : ''));
    log.debug('Paths: \n' + testpaths.join('\n'));

    async.eachSeries(testpaths, function (testpath, next) {
        var actualArgs = args.concat('--source=' + testpath);

        if (outdir) {
            rawpath = path.resolve(process.cwd(), outdir, path.basename(testpath).replace(/.js$/, '.json'));
            actualArgs.push('--raw=' + rawpath);
        }

        log.info('Executing: ' + testpath);
        log.debug('Args: ' + actualArgs.join(' '));

        spawn(cmd, actualArgs, {stdio: 'inherit'}).on('close', next);
    });
}
