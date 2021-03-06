// includes
var config = require("./config.js");
var log = require("./jlog.js");
var http = require("http");
var url = require("url");
var jwt = require("jsonwebtoken");
var redis = require("redis-url").connect(config.REDIS_URL);
var crypto = require("crypto");

// receive request
http.createServer(function(req, res){
	
	// all responses include these headers to support cross-domain requests
	var allowed_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"];
	var allowed_headers = ["Accept", "Accept-Version", "Content-Type", "Api-Version", "Origin", "X-Requested-With","Range","X_FILENAME","X-Access-Token", "X-Encrypted", "X-Private"];

	res.setHeader("Access-Control-Allow-Methods", allowed_methods.join(","));
	res.setHeader("Access-Control-Allow-Headers", allowed_headers.join(","));
	res.setHeader("Access-Control-Allow-Origin", "*");
	
	// validate token if presented
	var token = null;
	if(url.parse(req.url,true).query.token){
		try{
			token = jwt.verify(url.parse(req.url,true).query.token, config.SECRET);
		} catch(ex){
			log.message(log.ERROR, "unable to parse token: " + ex);
			res.statusCode = 401;
			res.write("unable to parse token: " + ex);
			res.end();
			return;
		}
	}
	
	// select endpoint
	var endpoint = url.parse(req.url).pathname.split("/")[1];
	log.message(log.DEBUG, "endpoint: " + endpoint);
		
	// verify that the token allows the requested method
	if(req.method === "POST" || (token && token[req.method])){
		// select method
		log.message(log.DEBUG, "method: " + req.method);
		switch(req.method){
			case("POST"):
				// POST returns an HTTP Status and a token with POST, GET, PUT, DELETE and OWNER
				var new_object = "";
				req.on("data", function(chunk){
					new_object += chunk;
				});
				req.on("end", function(){
					log.message(log.DEBUG, "new_object: " + new_object);
					// convert to js object for validation
					new_object = JSON.parse(new_object);
					
					// todo: validate incoming object against schema
					
					// generate object fingerprint
					var shasum = crypto.createHash("sha1");
					shasum.update(JSON.stringify(new_object));
					var fingerprint = shasum.digest("hex");
					log.message(log.DEBUG, "fingerprint: " + fingerprint);
					
					//  store object
					redis.set(endpoint + ":" + fingerprint, JSON.stringify(new_object), function(err, value){
						if(err){
							log.message(log.ERROR, "Error storing object: " + err);
							res.statusCode = 500;
							res.write("Error storing object: " + err);
							res.end();
						} else {
							// add to index
							redis.sadd(endpoint, fingerprint, function(err, value){
								if(err){
									log.message(log.ERROR, "Error updating " + endpoint + " index: " + err);
									res.statusCode = 500;
									res.write("Error updating " + endpoint + " index: " + err);
									res.end();
								} else {
									// return token (fingerprint?)
									var owner_token_permissions = {};
									owner_token_permissions.owner = true;
									owner_token_permissions.id = new_object.id;
									owner_token_permissions.endpoint = endpoint;
									owner_token_permissions.POST = false;
									owner_token_permissions.GET = true;
									owner_token_permissions.PUT = true;
									owner_token_permissions.DELETE = true;
									log.message(log.DEBUG, "owner_token_permissions: " + JSON.stringify(owner_token_permissions));
									var owner_token = jwt.sign(owner_token_permissions,config.SECRET);
									var result = {
										token: owner_token,
										fingerprint: fingerprint
									};
									res.statusCode = 200;
									res.write(JSON.stringify(result));
									res.end();
								}
							});
						}
					});
				});
				break;
			case("GET"):
				// GET requires a token with GET and returns an object minus restricted data
				// test path for specific object request or list
				var path = require("url").parse(req.url).pathname;
				if(path.slice(-1) === "/"){
					// validate token access for this endpoint
					if(token.endpoint === endpoint){
						// return object index
						redis.smembers(endpoint, function(err, index_values){
							if(err){
								log.message(log.ERROR,"Error loading index: " + err);
								res.statusCode = 500;
								res.write("Error loading index: " + err);
								res.end();
							} else {
								var obj_index = [];
								for(var obj in index_values){
									redis.get(endpoint + ":" + index_values[obj], function(err, value){
										if(err){
											log.message(log.WARN,"Error loading object from index: " + err);
										} else {
											if(value){
												obj_index.push(value);
											}
											if(obj_index.length == index_values.length){
												res.write(JSON.stringify(obj_index));
												res.end();
											}
										}
									});
								}
							}
						});
					} else {
						log.message(log.ERROR, "Supplied token does not grant index permission to the endpoint " + endpoint);
						res.statusCode = 401;
						res.write("Supplied token does not grant index permission to the endpoint " + endpoint);
						res.end();
					}
				} else {
				
					// load the requested object
					var id = path.split("/")[2];
					// load endpoint object index
					redis.smembers(endpoint, function(err, index_values){
						if(err){
							log.message(log.ERROR,"Error loading index: " + err);
							res.statusCode = 500;
							res.write("Error loading index: " + err);
							res.end();
						} else {
							var obj_index = [];
							var i = 0;
							for(var obj in index_values){
								redis.get(endpoint + ":" + index_values[obj], function(err, value){
									if(err){
										log.message(log.WARN,"Error loading object from index: " + err);
									} else {
										if(value){
											// only return objects with a matching ID
											if(JSON.parse(value).id === id){
												// todo: should we restrict objects to only those expressly allowed by the token?
												obj_index.push(value);
											}
											i++;
										}
										if(i == index_values.length){
											res.write(JSON.stringify(obj_index));
											res.end();
										}
									}
								});
							}
						}
					});
					/*
					var fingerprint = path.split("/")[2];
					log.message(log.DEBUG, "fingerprint: " + fingerprint);
					redis.get(endpoint + ":" + fingerprint, function(err, value){
						if(err){
							log.message("Error loading the requested object: " + err);
							res.statusCode = 500;
							res.write("Error loading the requested object: " + err);
							res.end();
						} else {
							if(value){
								// rehydrate the object
								var requested_object = JSON.parse(value);
								// validate object signature against requested object_id
								if(token.id === requested_object.id){
									// if the "new_token" parameter is supplied, return a new token with the requested
									// permissions instead of the object
									if(url.parse(req.url,true).query.new_token){
										log.message(log.DEBUG, "New token requested");
										var token_permissions = {};
										token_permissions.id = requested_object.id;
										token_permissions.endpoint = endpoint;
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
										res.write(JSON.stringify(requested_object));
										res.end();
									}
								} else {
									log.message(log.ERROR, "Supplied token is not authorized for requested object " + requested_object.object_id);
									res.statusCode = 401;
									res.write("Supplied token is not authorized for requested object " + requested_object.object_id);
									res.end();
								}
							} else {
								log.message("Requested object not found");
								res.statusCode = 404;
								res.write("Requested object not found");
								res.end();
							}
						}
					});
					*/
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
			case "OPTIONS":
				// support for OPTIONS is required to support cross-domain requests (CORS)
				res.writeHead(204);
				res.end();
				break;
			default:
				log.message(log.WARN, "Unknown method received: " + req.method);
		}
	} else {
		log.message(log.ERROR, "Supplied token does not authorize method " + req.method);
		res.statusCode = 401;
		res.end();
	}
}).listen(config.SERVER_PORT);
	