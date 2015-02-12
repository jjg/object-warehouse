Methods
POST /schema/object_id
GET /schema/object_id
PUT /schema/object_id
DELETE /schema/object_id

Parameters (case matters for values)
*  new_token	requests a new non-owner token with permissions based on the following parameters
	*  post (optional, boolean, defaults to false)
	*  get (optional, boolean, defaults to false)
	*  put (optional, boolean, defaults to false)
	*  delete (optional, boolean, defaults to false)