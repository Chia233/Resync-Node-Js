
const mysql = require('mysql');
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const session = require('cookie-session')

const app = express();

// //localhost testing
// const db = mysql.createConnection({
//     host:'localhost',
//     user: 'root',
//     password: '',
//     database: 'nodeAuth'
// });

//running in docker container
const db = mysql.createConnection({
    host: '172.17.0.1',
    user: 'root',
    password: 'password',
    database: 'nodeAuth'
});

//JWT Key pair
//use this as the secret if you want
let privateKey = fs.readFileSync('./private.key', 'utf8')
let publicKey = fs.readFileSync('./public.key', 'utf8')
let signOptions = {
    audience: "user",
    expiresIn: "5 minutes"
}

//listener 
app.listen('8080', () => {
    console.log("Listening to port 8080.")
})

//db
db.connect((err) => {
    if(err) {
        throw err;
    }
    console.log("Connection to MySQL DB is successful.");
});

//html
app.get('/', (request, response) => {
    response.sendFile(path.join(__dirname + '/index.html'));
    console.log("Returning index.html from root");
});

app.get('/register.html', (request, response) => {
    response.sendFile(path.join(__dirname + '/register.html'));
    console.log("Returning register.html");
});


//Create Database tables for user and countryDetail
app.get('/createtables', (request, response) => {
    
    console.log("Incoming create table request...");

    let sql = 'CREATE TABLE user(id int AUTO_INCREMENT, email VARCHAR(255), password VARCHAR(50), PRIMARY KEY(id))';
    
    db.query(sql, (err, result) => {
        if (err){
            if (err.code == "ER_TABLE_EXISTS_ERROR") {
                let exists = 1
                console.log("The table 'user' has already been created.")
            }
            else {
                console.log("There was an error creating the 'user' table")
            }
        }
        else {
            console.log(result);
        }
    });

    let sql2 = 'CREATE TABLE countryDetail(id int AUTO_INCREMENT, CountryName VARCHAR(255), GMTOffset VARCHAR(255))'
    
    db.query(sql2, (err, result) => {
        if (err) {
            if (err.code == "ER_TABLE_EXISTS_ERROR") {
                let exists = 1
                console.log("The table 'countryDetail' has already been created.")
            }
            else {
                console.log("There was an error with creating the 'countryDetail' table.")
            }
        }
        else {
            console.log(result);
        }
    });
    
    if (typeof(exists) != null) {
        response.send("The table already exists.")
    }
    else {
        response.send("Tables user and countryDetail created successfully.")
    }
});

//Populate tables
app.get('/populatetables', (request, response) => {
    
    console.log("Incoming table population...")
    console.log(request)

    let populateUser = "INSERT INTO user (id, email, password) VALUES (NULL, 'hello@world.com', '12345');"
    let populateCountry = "INSERT INTO countrydetail (CountryName, GMTOffset) VALUES ('Singapore', 'GMT+8'),('Japan','GMT+9'),('New Zealand', 'GMT+12');"

    db.query(populateUser, (err,result) => {
        if (err) {
            console.log("User creation unsuccessful");
            console.log(err);
            response.send("There was an error with creating a new user. Please try again.");
        }
        else {
            console.log("User creation successful");
            console.log(result);
        }
    });

    db.query(populateCountry, (err,result) => {
        if (err) {
            console.log("Populate country unsuccessful");
            console.log(err);
            response.send("There was an error with creating countries. Please try again.");
        }
        else {
            console.log("Country creation successful");
            console.log(result);
            response.send("User and country tables populated successfully");
        }
    });
})
//Parse user creation
app.post('/createuser', express.json(), (request, response) => {
    
    console.log("Incoming new user creation...");
    console.log(request);

    let createEmail = request.body.email
    let createPassword = request.body.password
    let getCreate = " INSERT INTO user(email, password) VALUES ('" + createEmail + "','" + createPassword + "')"
    console.log("The insert query is " + getCreate);
    
    db.query(getCreate, (err, result) => {
        if (err) {
            console.log("Failed to create user.");
            console.log(err);
            console.log("Returning response...")
            response.set("Content-Type", "application/json")
            response.send({text:"Failed to create your account. Please try again."})
        }
        else {
            console.log("User with email " + createEmail + " created successfully.")
            console.log(result);
            console.log("Returning response...")
            response.set("Content-Type", "application/json")
            response.send({text: "Your account has been successfully created."})
        }
    });
});

//Parse Login info and initialize the session
app.post('/login', session({keys:['key1']}), express.json(), (request, response) => {
    
    console.log("Incoming login request...");
    console.log(request);

    //store pw and email to session
    request.session.email = request.body.email
    request.session.password = request.body.password

    let email = request.body.email
    let password = request.body.password
    let getLogin = "SELECT * FROM user WHERE email = '" + email + "' AND password = '" + password + "'"
    console.log("The login query is " + getLogin);

    db.query(getLogin, (err, result) => {
        if (err || result.length == 0) {
            console.log("There is no such user in the database");
            console.log("Returning response...")
            response.set("Content-Type", "application/json");
            response.send({text:"Your email or password appears to be incorrect"});
        }
        if (result.length > 0) {
            console.log("Query matched.");
            console.log(result);
            console.log("Returning response...")
            response.set("Content-Type", "application/json");
            let currentUser = {
                email: email,
                password: password
            }
            jwt.sign({user: currentUser}, 'key', signOptions, (err, token) => {
                if (err) {
                    console.log(err);
                }
                else {
                    response.json({
                        token: token,
                        text: "You are now logged in!"
                    })
                }
            })
        }
    })
}); 

//verify with JWT, parse authorization param in header to get the token
function verify(request, response, next) {
    
    console.log("Verifying incoming token...")
    console.log(request)
    
    const header = request.headers['authorization'];
    console.log("The current auth token is " + header);

    if(typeof header !='undefined'){
        request.token = header
        next();
    }
    else {
        response.json({
            text: "Either the auth key expired or you are not logged in, please login again!"
        })
    }
}

//Parse getAllCountryDetails
app.post('/allCountryDetails', express.json(), verify, (request,response) => {
    
    console.log("Incoming allCountryDetails request...");
    console.log("Verifying token...")

    jwt.verify(request.token, 'key', (err,data) =>{
        if (err) {
            console.log("Verification failed! Sending an appropriate text response...")
            response.json({text: "Verification failed! Auth token is invalid. Please login and try again."});
        }
        else {
            let getAllCountryDetails = 'SELECT * FROM countrydetail'
            db.query(getAllCountryDetails, (err,result) => {
                if (err) {
                    console.log("Error getting the countryDetails");
                    console.log(err);
                    response.json({
                        text: "There was an error in retreiving the countryDetails. Please try again."
                    })
                }
                else {
                    console.log(result);
                    response.json({query: result});
                }
            })
        }
    })
})

//Parse getCountryDetails
app.post('/countryDetails', express.json(), verify, (request,response) =>{
    
    console.log("Incoming countryDetails request...");
    console.log("Verifying token...");
    console.log(request)

    jwt.verify(request.token,'key',(err, data)=> {
        if (err) {
            console.log("Verification failed! Sending an appropriate text response...")
            response.json({text: "Verification failed! Auth token is invalid. Please login and try again."})
        }
        else {
            let countryRequest = request.headers.country
            let specificCountry = "SELECT GMTOffset FROM countrydetail WHERE CountryName = '" + countryRequest + "'"
            console.log("The query is " + specificCountry);
            
            db.query(specificCountry, (err,result) => {
                if (err){
                    console.log("There is a problem with the query!");
                    console.log(err);
                    response.json({text: "The query was unsuccessful, please try again."})
                }
                else {
                    console.log("Query successful. Returning json response...");
                    console.log(result);
                    response.json({
                        query: result,
                        text: "The query was successful."
                    })
                }
            })
        }
    })
})

//Parse refresh token
app.post('/refreshToken', session({keys:['key1']}), express.json(), verify, (request,response) => {
    
    console.log("Incoming refreshToken request...");
    console.log("Verifying token...");

    jwt.verify(request.token , 'key', function(err,decoded) {

        var savedUser = {
            user: request.session.email,
            password: request.session.password
        }

        if (typeof err !=='null' || err.message == 'jwt expired') {
            console.log("Current token has expired and needs to be refreshed");
            
            jwt.sign({user: savedUser} , 'key', signOptions, (err,token) => {
                if (err) {
                    console.log("There was an error with refreshing the token");
                    console.log(err);
                    response.json({text: "There was an error in refreshing your token. Try logging in again."})
                }
                else {
                    console.log("Your token has been refreshed");
                    response.json({
                        token: token,
                        text: "Your token has been refreshed"
                    })
                }
            });
        }
        else {
            console.log("The token is still valid but will be refreshed anyway");
            jwt.sign({user: savedUser}, 'key', signOptions, (err,token)=> {
                if (err) {
                    console.log("There was an error with refreshing the token");
                    console.log(err);
                    response.json({text: "There was an error in refreshing your token. Try logging in again."})
                }
                else {
                    const test = new constructor.chalk() 
                    console.log("Your token has been refreshed");
                    response.json({
                        token: token,
                        text: "Your token has been refreshed"
                    });
                };
            });
        };
    });
});
