## Description:
Usof-Web is a new, lightweight project for a communal problem-solving. In this program, the users can create personal accounts for communication with fellow %profession-name%, increasing personal productivity significantly through shared discussion and knowledge exchange!

## Technical Requirements:
Right now, the following libraries and tools are required for work:
- Node.js: 18.x,
- npm: 9.x,
- bcrypt: 6.x,
- body-parser: 1.20.x,
- ejs: 3.1.10,
- express: 4.18.x,
- express-session: 1.18.1,
- multer: 2.0.2,
- mysql2: 3.3.3,
- nodemailer: 7.0.3.

The project uses MySQL. The schema and sample data are migrated automatically on first run.
As of now, all required libraries are already built-in!

## Installation:
To install the program, you will have to clone the repository it is run on. To do this, run in terminal:

git clone ssh://git@git.green-lms.app:22022/challenge-370/mshkolnyk-6095.git

## How to Run:
First and foremost, you are supposed to start up the program from within the root directory of it. Before running, ensure that you are now within:

~/mshkolnyk-6095

For it is the root folder where the index.js file is located. To start up the server, run:

node index.js
OR
node.exe index.js

This will immediately not only create the server, the instance, and the database schema, but it also will migrate test data into the aforementioned schema, for the potential customer to see the capabilities unfurled!

After creating the server, you should follow:

http://localhost:3000

To see the site for yourself. Feel free to register your own account, but be warned that one will have to have their account email confirmed! For this, we have simulated the process through ethereal email. Right now it is:

user: wendy.jakubowski8@ethereal.email

pass: mVrnkX3VXfZefUGx82

In case it is not working, feel free to replace the transporter in AuthController.js.

So you just have to go to ethereal.email and login through this userpass, check Messages, and follow the link in the newest message to confirm the email.
That's it! You have created your own account in USOF! It is protected by an encrypted password!

## Functionality and Features:
So far the following functions are realised:
- posting (creation, updating, activation, deactivation, locking, deletion, edition, upvoting, downvoting)
- commenting (creation, activation, deactivation, locking, deletion, upvoting, downvoting)
- account personalization (profile picture change, nickname change, email address change, password change)
- categorization (creation, sorting, updating - admin only, deletion - admin only)

Feel free to try out everything yourself!

## Screenshots:
![Login Page](https://www.dropbox.com/scl/fi/1bck5amxwnm8lf2s1zwlq/screen-1.png?rlkey=spq6v67awbbccqs2hg1x3s9dm&st=7oam3i6u&dl=0](https://www.dropbox.com/home/usof-backend?preview=screen-1.png)
