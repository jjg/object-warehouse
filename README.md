#REQUIREMENTS:

* Redis
* Node.js

#SETUP:

1. Clone the repository
2. Copy config.ex to config.js (defaults should "just work" but review and edit to your liking)
3. `npm install`
3. `npm start`

#BASIC USAGE:
	
POST a JSON object to an endpoint to store it:

    curl -X POST -d '{"id":"foo","name":"bar","flavor":"baz"}' "http://localhost:5000/examples/foo"
	
Note the `id` property, this is *required* and eventually will be the handle used by clients to retreive an object by name. `id` is not assumed to be unique, and multiple different objects with duplicate `id`s can be stored safely.

Executing the command above will return a JSON object:

`````
{
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJvd25lciI6dHJ1ZSwiaWQiOiJmb28iLCJlbmRwb2ludCI6ImV4YW1wbGVzIiwiUE9TVCI6ZmFsc2UsIkdFVCI6dHJ1ZSwiUFVUIjp0cnVlLCJERUxFVEUiOnRydWUsImlhdCI6MTQyMzg0NzI3NH0.7CI6Ke1PbpOB4wuR9Fa5OTjKbmd5XbJuoc70Es2D9WQ",
    "fingerprint": "e6e7a89c364086290d8b94ba143137edd0369f23"
}
`````

The `fingerprint` is a unique handle to a specific stored object.  This is used internally to unambiguously identify stored items and eventually it may not be exposed externally so don't go falling in love with it (if it goes away it will be replaced with another method of selecting a single instance of an object at an endpoint).  For now you can retreive the object you just stored using the fingerprint like so:

    curl "http://localhost:5000/examples/e6e7a89c364086290d8b94ba143137edd0369f23?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJvd25lciI6dHJ1ZSwiaWQiOiJmb28iLCJlbmRwb2ludCI6ImV4YW1wbGVzIiwiUE9TVCI6ZmFsc2UsIkdFVCI6dHJ1ZSwiUFVUIjp0cnVlLCJERUxFVEUiOnRydWUsImlhdCI6MTQyMzg0NzI3NH0.7CI6Ke1PbpOB4wuR9Fa5OTjKbmd5XbJuoc70Es2D9WQ
	
The token is included in all subsequent requests for the object.

In addition to the expected GET, PUT and DELETE actions there are two other custom behavoirs.  If you want to share the object you can generate additional keys with specific types of access by making a GET request for the object and specifying the permissions as parameters, like so:

    curl "http://localhost:5000/examples/{fingerprint}?token={token}&GET=true&PUT=false&DELETE=false"
	
This will return a new token that allows the actions requested (*NOTE: case matters here so specify permissions using the same case shown above!*).  Only specified permissions will be set explicitly, any left out will default to `false`. `POST` permission is meaningless after object creation so requests for it will simply be ignored.

You can also request an index of the objects stored at a given endpoint by performing a GET request against the endpoint name and including the trailing `/`.  You still need to provide a valid token for an object that has been stored at the endpoint (this is a compromise for now between leaving endpoint indexes wide-open and implementing a complicated authorization scheme, it may change later once we come up with something better).  For example:

    curl "http://localhost:5000/examples/?token={token}
	
This returns an array of fingerprints for the objects stored at this location.  These fingerprints can be used to fetch a specific object stored at the specified endpoint, eventually this may return additional object information but that's still up-in-the-air at the moment.

#TODO
`PUT` and `DELETE` HTTP verbs are not yet implemented, and there may be additional changes as noted above.