"use strict";

var request = require("request"),
    Q = require("q"),

    IG_AUTH_ENDPOINT = "https://api.ig.com/gateway/deal/session/";

// Create a new IGSession to store the various bits and bobs needed to perform
// the various calls
var IGSession = function(apiKey, username, password) {
  this.apiKey = apiKey;
  this.username = username;
  this.password = password;
};

// Create a IG Api session from the information in the IGSession. Hits the
// IG_AUTH_ENDPOINT and stores the returned headers. Returns a deferred that
// resolves to the JSON parsed body of the response.
IGSession.prototype.login = function() {
  var deferred = Q.defer();
  var self = this;

  request({
      // Documentation about this endpoint:
      // http://labs.ig.com/rest-trading-api-reference/service-detail?id=5
      url: IG_AUTH_ENDPOINT,
      method: "POST",
      headers: {
        // Attach the API key
        "X-IG-API-KEY": this.apiKey,
        // Sending JSON, yawn
        "Content-Type": "application/json",
        // Receiving JSON, yawn
        "Accept": "application/json"
      },
      // Username becomes identifier
      body: JSON.stringify({"identifier": this.username, "password": this.password})
    }, function(err, resp, body) {
      if (err !== null) {
        deferred.reject(err);
        return;
      }
      // The only valid status code is 200
      if (resp.statusCode !== 200) {
        deferred.reject(new Error("Invalid status code: " + resp.statusCode));
        return;
      }
      var parsedBody;
      try {
        // The body is JSON
        parsedBody = JSON.parse(body);
      } catch (err) {
        deferred.reject(err);
        return;
      }
      // These headers will be attached to all API calls going forward.
      // CST = Client Security Token
      // XST = Account Security Token
      self.cst = resp.headers["cst"];
      self.xst = resp.headers["x-security-token"];

      if (!self.cst || !self.xst) {
          deferred.reject(new Error(
              "Response had no cst or x-security-token headers"));
          return;
      }

      // We'll save this, not sure if this is good practise or not
      self.lightstreamerEndpoint = parsedBody.lightstreamerEndpoint;

      deferred.fulfill(parsedBody);
    });

  return deferred.promise;
};

// Perform an arbitrary request, attaching the various authenticating stuff.
// Returns the JSON parsed response body.
IGSession.prototype.perform = function(url, method, body) {
    var deferred = Q.defer();
    var self = this;

    request({
        url: url,
        method: method,
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            // Attach the apiKey, client security token, and application
            // security token
            "X-IG-API-KEY": this.apiKey,
            "CST": this.cst,
            "X-SECURITY-TOKEN": this.xst
        },
        // If there is no body, do not set any body
        body: body == undefined ? undefined : JSON.stringify(body)
    }, function(err, resp, body) {
        if (err !== null) {
            deferred.reject(err);
            return;
        }
        if (resp.statusCode !== 200) {
            deferred.reject(new Error("Invalid status code: " + resp.statusCode));
            return;
        }
        var parsedBody;
        try {
            parsedBody = JSON.parse(body);
        } catch (err) {
            deferred.reject(err);
            return;
        }
        deferred.fulfill(parsedBody);
    });
  return deferred.promise;
};

// Documentation: http://labs.ig.com/rest-trading-api-reference/service-detail?id=4
IGSession.prototype.marketSearch = function(searchTerm) {
  return this.perform(
    "https://api.ig.com/gateway/deal/markets?searchTerm=" + searchTerm, "GET");
};

// Export the IGSession
module.exports = IGSession;
