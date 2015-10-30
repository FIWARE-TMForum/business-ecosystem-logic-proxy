/**
 * Created by francisco on 30/10/15.
 */

exports.attachUserHeaders = function(headers, userInfo) {
    headers['X-Nick-Name'] = userInfo.id;
    headers['X-Display-Name'] = userInfo.displayName;
    headers['X-Roles'] = userInfo.roles;
    headers['X-Organizations'] = userInfo.organizations;
};
