/*
	ofactory: generic json-schema based object store
	
	token payload:
	{
		object_id:<hash of object>,
		post:<boolean>,
		get:<boolean>,
		put:<boolean>
		delete:<boolean>,
		owner:<boolean
	}
	
	schema
	Use schema "title" to define endpoint name
	Use schema "id" as the slug or path name
	Use a generated fingerprint of the object as the absolute internal identifier
	Create a Redis SET for each endpoint to store a list of stored object fingerprints
	
*/

// includes
var config = require("./config.js");
var log = require("./jlog.js");
var http = require("http");
var url = require("url");
var jwt = require("jsonwebtoken");
var redis = require("redis-url").connect(config.redis_url);
var crypto = require("crypto");

// globals
var schemas = [	// currently hard-coded but will ultimately come from schema server
		{
			"title": "Example Schema",
			"type": "object",
			"properties": {
				"firstName": {
				  "type": "string"
				},
				"lastName": {
				  "type": "string"
				},
				"age": {
				  "description": "Age in years",
				  "type": "integer",
				  "minimum": 0
				}
			},
			"required": ["firstName", "lastName"]
		}
	];

// receive request
http.createServer(function(req, res){
	
	// validate token if presented
	var token = null;
	if(url.parse(req.url,true).query.token){
		try{
			token = jwt.verify(url.parse(req.url,true).query.token, config.SECRET);
		} catch(ex){
			log.message(log.ERROR, "unable to parse token: " + ex);
			res.statusCode = 401;
			res.end();
			return;
		}
	}
	
	// select endpoint
	var endpoint = url.parse(req.url).pathname.split("/")[1];
	log.message(log.DEBUG, "endpoint: " + endpoint);
		
	// verify that the token allows the requested method
	if(req.method === "POST" || token[req.method]){
		
		// select method
		log.message(log.DEBUG, "method: " + req.method);
		switch(req.method){
			case("POST"):
				// POST returns an HTTP Status and a token with POST, GET, PUT, DELETE and OWNER
			
				//log.message(log.DEBUG, req);
				
				var new_object = "";
				
				req.on("data", function(chunk){
					new_object += chunk;
				});
				
				req.on("end", function(){
					log.message(log.DEBUG, "new_object: " + new_object);
					
					// todo: validate incoming object against schema
					
					// generate object fingerprint
					var shasum = crypto.createHash("sha1");
					shasum.update(new_object);
					var fingerprint = shasum.digest("hex");
					log.message(log.DEBUG, "fingerprint: " + fingerprint);
					
					// todo: store object
					
					// return token (fingerprint?)
					var owner_token_permissions = {};
					owner_token_permissions.owner = true;
					owner_token_permissions.POST = false;
					owner_token_permissions.GET = true;
					owner_token_permissions.PUT = true;
					owner_token_permissions.DELETE = true;
					log.message(log.DEBUG, "owner_token_permissions: " + JSON.stringify(owner_token_permissions));
					var owner_token = jwt.sign(owner_token_permissions,config.SECRET);
					res.statusCode = 200;
					res.write(JSON.stringify(owner_token));
					res.end();
				});
				
				break;
			case("GET"):
				// GET requires a token with GET and returns an object minus restricted data
				
				// todo: load the requested object
				var obj = {object_id:"foo"};	// currently stubbed
				
				// validate object signature against requested object_id
				if(token.object_id === obj.object_id){
					
					// if the "new_token" parameter is supplied, return a new token with the requested
					// permissions instead of the object
					if(url.parse(req.url,true).query.new_token){
						log.message(log.DEBUG, "New token requested");
						var token_permissions = {};
						token_permissions.POST = (url.parse(req.url,true).query.POST === "true") || false;
						token_permissions.GET = (url.parse(req.url,true).query.GET === "true") || false;
						token_permissions.PUT = (url.parse(req.url,true).query.PUT === "true") || false;
						token_permissions.DELETE = (url.parse(req.url,true).query.DELETE === "true") || false;
						log.message(log.DEBUG, "token_permissions: " + JSON.stringify(token_permissions));
						var new_token = jwt.sign(token_permissions,config.SECRET);
						res.statusCode = 200;
						res.write(JSON.stringify(new_token));
						res.end();
					} else {
						res.statusCode = 200;
						res.write(JSON.stringify(obj));
						res.end();
					}
				} else {
					log.message(log.ERROR, "Supplied token is not authorized for requested object " + obj.object_id);
					res.statusCode = 401;
					res.end();
				}
				break;
			case("PUT"):
				// todo: PUT requires a token with PUT and returns an HTTP Status
			
				// todo: validate object signature against requested object_id
				
				// todo: validate incoming object against schema
				break;
			case("DELETE"):
				// todo: DELETE requires a token with DELETE and OWNER and returns an HTTP Status
			
				// todo: validate object signature against requested object_id
				break;
			default:
				log.message(log.WARN, "Unknown method received: " + req.method);
		}
	} else {
		log.message(log.ERROR, "Supplied token does not authorize method " + req.method);
		res.statusCode = 401;
		res.end();
	}

	// log the result of the request
	log.message(log.INFO, "Result: " + res.statusCode);

}).listen(config.SERVER_PORT);
	