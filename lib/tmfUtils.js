var config = require('./../config');

exports.checkRole = function (userInfo, role) {
    var valid = false;

    // Search for provider role
    for (var i = 0; i < userInfo.roles.length && !valid; i++) {
        if (userInfo.roles[i].name.toLowerCase() === role.toLowerCase()) {
            valid = true;
        }
    }

    return valid;
};

// Check whether the owner role is included in the info field
exports.isOwner = function (userInfo, info) {
    var status = false;
    if (exports.checkRole(userInfo, config.oauth2.roles.admin)) {
        status = true;
    } else if (info.relatedParty) {
        var parties = info.relatedParty;

        for(var i = 0; !status && i < parties.length; i++) {
            var party = parties[i];

            if (party.role.toLowerCase() == 'owner' && party.id == userInfo.id) {
                status = true
            }
        }
    }

    return status;
};

//
// Checks if the user is logged in
exports.validateLoggedIn = function(req, callback) {
    if (req.user) {
        callback();
    } else {
        callback({
            status: 401,
            message: 'You need to be authenticated to create/update/delete resources'
        });
    }
};