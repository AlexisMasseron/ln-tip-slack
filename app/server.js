// set up ========================
const debug = require('debug')('lncliweb:server')
const express  = require('express')
const session = require('express-session')
const Grant = require('grant-express')
const grant = new Grant(require('../config/grant-config.js'))
const bodyParser = require('body-parser')         // pull information from HTML POST (express4)
const methodOverride = require('method-override') // simulate DELETE and PUT (express4)

// expose the server to our app with module.exports
module.exports = function (program) {

	var module = {};

	// load app default configuration data
	const defaults = require('../config/config');

	// setup winston logging ==========
	const logger = require('../config/log')((program.logfile || defaults.logfile), (program.loglevel || defaults.loglevel)); 

	// setup authentication =================
	const basicauth = require("./basicauth")(program.user, program.pwd, program.limituser, program.limitpwd).filter;

	// db init =================
	const db = require('./database')(defaults.dataPath);

	// setup lightning client =================
	const lightning = require("./lightning")(defaults.lndProto, (program.lndhost || defaults.lndHost));

	// init lnd module =================
	const lnd = require("./lnd")(lightning);

	// init slacktip module =================
	const slacktip = require("./slacktip")(lightning, lnd, db, require('../config/slack-config'));

	// app creation =================
	const app = express();                                          // create our app w/ express
	app.use(session({ secret: 'dvv4gj4MfVWJRrFwlwNs', cookie: { maxAge: 300000 }, resave: true, saveUninitialized: true }))

	// app configuration =================
	app.use(require("./cors"));                                     // enable CORS headers
	app.use(grant);                                                 // mount grant
	app.use(['/lnd.html', '/api/lnd/'], basicauth);                 // enable basic authentication for lnd apis
	app.use(express.static(__dirname + '/../public'));              // set the static files location /public/img will be /img for users
	app.use(bodyParser.urlencoded({'extended':'true'}));            // parse application/x-www-form-urlencoded
	app.use(bodyParser.json());                                     // parse application/json
	app.use(bodyParser.json({ type: 'application/vnd.api+json' })); // parse application/vnd.api+json as json
	app.use(methodOverride());
	// error handler
	app.use(function(err, req, res, next) {
	  // Do logging and user-friendly error message display
	  winston.error(err);
	  res.status(500).send({status:500, message: 'internal error', type:'internal'}); 
	});

	// init server =================
	var server;
	if (program.usetls) {
		server = require('https').createServer({
			key: require('fs').readFileSync(program.usetls + '/key.pem'),
			cert: require('fs').readFileSync(program.usetls + '/cert.pem')
		}, app);
	} else {
		server = require('http').Server(app);
	}
	const io = require('socket.io')(server);

	// setup sockets =================
	var lndLogfile = program.lndlogfile || defaults.lndLogFile;
	require("./sockets")(io, lightning, lnd, program.user, program.pwd, program.limituser, program.limitpwd, lndLogfile);

	// setup routes =================
	require("./routes")(app, lightning, slacktip, db);

	// define useful global variables ======================================
	module.useTLS = program.usetls;
	module.serverPort = program.serverport || defaults.serverPort;
	module.serverHost = program.serverhost || defaults.serverHost;

	// listen (start app with node server.js) ======================================
	server.listen(module.serverPort, module.serverHost);

	logger.info("App listening on " + module.serverHost + " port " + module.serverPort);

	module.server = server;

	return module;
}
