const Model = require('../model.js');

class User extends Model {
    static tableName = 'users';
    static uniqueFields = ['login', 'email'];

    constructor({ 
        id = null, 
        login = null, 
        password = null, 
        full_name = null, 
        email = null, 
        status = 'user', 
        email_confirmed = false,
        email_token = null,
        reset_token = null,
        reset_token_expires = null,
        profile_picture = null 
    } = {}) {
        super({ 
            id, 
            login, 
            password, 
            full_name, 
            email, 
            status, 
            email_confirmed, 
            email_token,
            reset_token,
            reset_token_expires,
            profile_picture 
        });
    }
}

module.exports = User;
