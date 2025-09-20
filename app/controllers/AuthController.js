const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../models/user');

// Update as soon as the old ethereal runs out
const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
        user: 'wendy.jakubowski8@ethereal.email',
        pass: 'mVrnkX3VXfZefUGx82'
    }
});

// Update this one too!
const senderEmail = 'wendy.jakubowski8@ethereal.email';

class AuthController {
    // POST /api/auth/register - Register new user
    static async register(req, res) {
        try {
            const { login, password, confirmPassword, email, full_name } = req.body;

            // Validation
            if (!login || !password || !email) {
                return res.status(400).json({ 
                    message: 'Login, password, and email are required' 
                });
            }

            if (password !== confirmPassword) {
                return res.status(400).json({ message: 'Passwords do not match' });
            }

            if (password.length < 6) {
                return res.status(400).json({ 
                    message: 'Password must be at least 6 characters long' 
                });
            }

            // Check if user already exists
            const existingUserByLogin = await User.findByField('login', login);
            if (existingUserByLogin) {
                return res.status(409).json({ message: 'Login already exists' });
            }

            const existingUserByEmail = await User.findByField('email', email);
            if (existingUserByEmail) {
                return res.status(409).json({ message: 'Email already registered' });
            }

            // Generate email confirmation token
            const emailToken = crypto.randomBytes(32).toString('hex');

            const saltRounds = 12; // Higher than default 10 for better security
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            const newUser = new User({
                login,
                password: hashedPassword, // Store hashed password instead of plain text
                full_name: full_name || login,
                email,
                email_confirmed: false,
                email_token: emailToken,
                status: 'user'
            });

            await newUser.save();

            // Send confirmation email
            try {
                const confirmationLink = `${req.protocol}://${req.get('host')}/api/auth/confirm-email/${emailToken}`;
                
                const mailOptions = {
                    from: `"USOF Registration" <${senderEmail}>`,
                    to: email,
                    subject: 'Confirm Your Email - USOF',
                    html: `
                        <h2>Welcome to USOF!</h2>
                        <p>Hello ${full_name || login},</p>
                        <p>Please click the link below to confirm your email address:</p>
                        <a href="${confirmationLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Confirm Email</a>
                        <p>Or copy and paste this link into your browser:</p>
                        <p>${confirmationLink}</p>
                        <p>If you didn't register for USOF, please ignore this email.</p>
                    `
                };

                await transporter.sendMail(mailOptions);
            } catch (emailError) {
                console.error('Failed to send confirmation email:', emailError);
                // Don't fail registration if email fails
            }

            res.status(201).json({ 
                message: 'User registered successfully. Please check your email to confirm your account.',
                userId: newUser.attributes.id
            });
        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({ 
                message: 'Registration failed', 
                error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
            });
        }
    }

    // GET /api/auth/confirm-email/:token - Confirm email
    static async confirmEmail(req, res) {
        try {
            const { token } = req.params;
            
            if (!token) {
                return res.status(400).json({ message: 'Token is required' });
            }

            const user = await User.findByField('email_token', token);

            if (!user) {
                return res.status(400).json({ message: 'Invalid or expired confirmation token' });
            }

            if (user.attributes.email_confirmed) {
                return res.status(200).json({ message: 'Email already confirmed. You can log in.' });
            }

            user.attributes.email_confirmed = true;
            user.attributes.email_token = null;
            await user.save();

            // Auto-redirect to login page with success message
            res.redirect('/login.html?confirmed=true');
        } catch (error) {
            console.error('Email confirmation error:', error);
            res.status(500).json({ 
                message: 'Email confirmation failed', 
                error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
            });
        }
    }

    // POST /api/auth/login - Login user
    static async login(req, res) {
        try {
            const { login, email, password } = req.body;
            
            if (!password) {
                return res.status(400).json({ message: 'Password is required' });
            }

            if (!login && !email) {
                return res.status(400).json({ message: 'Login or email is required' });
            }

            let user;
            if (login) {
                user = await User.findByField('login', login);
            } else if (email) {
                user = await User.findByField('email', email);
            }

            if (!user) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            const isPasswordValid = await bcrypt.compare(password, user.attributes.password);
            if (!isPasswordValid) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            if (!user.attributes.email_confirmed) {
                return res.status(401).json({ 
                    message: 'Please confirm your email before logging in. Check your inbox for the confirmation link.' 
                });
            }

            // Set session
            req.session.userId = user.attributes.id;
            req.session.userStatus = user.attributes.status;

            res.json({ 
                message: 'Login successful',
                user: {
                    id: user.attributes.id,
                    login: user.attributes.login,
                    full_name: user.attributes.full_name,
                    status: user.attributes.status
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ 
                message: 'Login failed', 
                error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
            });
        }
    }

    // POST /api/auth/logout - Logout user
    static async logout(req, res) {
        try {
            if (!req.session.userId) {
                return res.status(400).json({ message: 'Not logged in' });
            }

            req.session.destroy(err => {
                if (err) {
                    console.error('Logout error:', err);
                    return res.status(500).json({ message: 'Failed to log out' });
                }
                res.clearCookie('connect.sid'); // Clear session cookie
                res.json({ message: 'Logged out successfully' });
            });
        } catch (error) {
            console.error('Logout error:', error);
            res.status(500).json({ message: 'Logout failed' });
        }
    }

    // POST /api/auth/password-reset - Send password reset email
    static async passwordReset(req, res) {
        try {
            const { email } = req.body;
            
            if (!email) {
                return res.status(400).json({ message: 'Email is required' });
            }

            const user = await User.findByField('email', email);

            if (!user) {
                // Don't reveal if user exists - for security
                return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
            }

            // Generate reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

            user.attributes.reset_token = resetToken;
            user.attributes.reset_token_expires = resetTokenExpires;
            await user.save();

            // Send reset email
            try {
                const resetLink = `${req.protocol}://${req.get('host')}/api/auth/password-reset/${resetToken}`;
                
                const mailOptions = {
                    from: `"USOF Password Reset" <${senderEmail}>`,
                    to: email,
                    subject: 'Password Reset - USOF',
                    html: `
                        <h2>Password Reset Request</h2>
                        <p>Hello ${user.attributes.full_name},</p>
                        <p>You requested a password reset. Click the link below to set a new password:</p>
                        <a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
                        <p>Or copy and paste this link into your browser:</p>
                        <p>${resetLink}</p>
                        <p>This link will expire in 1 hour.</p>
                        <p>If you didn't request this reset, please ignore this email.</p>
                    `
                };

                await transporter.sendMail(mailOptions);
            } catch (emailError) {
                console.error('Failed to send reset email:', emailError);
                // Still return success to not reveal if user exists
            }

            res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
        } catch (error) {
            console.error('Password reset error:', error);
            res.status(500).json({ 
                message: 'Failed to send reset email', 
                error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
            });
        }
    }

    // POST /api/auth/password-reset/:confirm_token - Reset password with token
    static async confirmPasswordReset(req, res) {
        try {
            const { confirm_token } = req.params;
            const { password, confirmPassword } = req.body;

            if (!confirm_token) {
                return res.status(400).json({ message: 'Reset token is required' });
            }

            if (!password) {
                return res.status(400).json({ message: 'New password is required' });
            }

            if (password !== confirmPassword) {
                return res.status(400).json({ message: 'Passwords do not match' });
            }

            if (password.length < 6) {
                return res.status(400).json({ 
                    message: 'Password must be at least 6 characters long' 
                });
            }

            const user = await User.findByField('reset_token', confirm_token);

            if (!user) {
                return res.status(400).json({ message: 'Invalid reset token' });
            }

            if (!user.attributes.reset_token_expires || new Date() > new Date(user.attributes.reset_token_expires)) {
                return res.status(400).json({ message: 'Reset token has expired' });
            }

            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            user.attributes.password = hashedPassword; // Store hashed password
            user.attributes.reset_token = null;
            user.attributes.reset_token_expires = null;
            await user.save();

            res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
        } catch (error) {
            console.error('Password reset confirmation error:', error);
            res.status(500).json({ 
                message: 'Password reset failed', 
                error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message 
            });
        }
    }

    // Legacy method for compatibility
    static async sendReminder(req, res) {
        return this.passwordReset(req, res);
    }
}

module.exports = AuthController;