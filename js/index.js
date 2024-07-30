import {
    createProgressGraph,
    createXpByProjectGraph,
    createAuditDetailsGraph,
} from "./profile.js";

// Function to load user profile data
const loadUserProfile = async () => {
    // Retrieve JWT token from session storage
    const userToken = sessionStorage.getItem("JWT");
    if (userToken) {
        // Show profile and hide login wrapper if user is authenticated
        document.getElementById("loginWrapper").style.display = "none";
        document.getElementById("profileWrapper").style.display = "block";

        // Set up logout button functionality
        document.getElementById("logoutButton").addEventListener("click", () => {
            sessionStorage.removeItem("JWT");
            window.location.href = "/";
        });

        // Function to fetch and display user data
        const showData = async () => {
            console.log("Fetching user data...");

            // Fetch user data, user progress, XP by project, and audit details
            const userData = await getUserData(userToken);
            const userProgress = await getUserProgress(userToken);
            const xpByProject = await getXpByProject(userToken);
            const auditDetails = await getAuditDetails(userToken);
            
            console.log("Data fetched successfully:", userData, userProgress, xpByProject, auditDetails);
        
            createUserData(userData);
            createXpAmountInfo(userData.totalXp);
            createAuditDetails(userData);
            createProgressGraph(userProgress, userData.totalXp);
            createXpByProjectGraph(xpByProject);
            createAuditDetailsGraph(auditDetails);
        };
        
        showData();
    }
};

// Fetch user data from the server
const getUserData = async (userToken) => {
    const query = `{
        user {
            login
            firstName
            lastName
            email
            campus
            attrs
            totalUp
            totalDown
            auditRatio
            transactions_aggregate (
                where: {
                    path: {_regex: "^\\/johvi\\/div-01\\/[-\\\\w]+$"}
                    type: {_eq:"xp"}
                },
            ) {
                aggregate {
                    sum {amount}
                } 
            }
        }
    }`;
    const queryBody = {
        query,
    };

    const results = await getQueryResults(queryBody, userToken);
    const totalXp = results.data.user[0].transactions_aggregate.aggregate.sum.amount;

    const userData = {
        username: results.data.user[0].login,
        firstName: results.data.user[0].firstName,
        lastName: results.data.user[0].lastName,
        email: results.data.user[0].email,
        campus: results.data.user[0].campus,
        attrs: results.data.user[0].attrs,
        auditRatio: results.data.user[0].auditRatio,
        auditXpDone: results.data.user[0].totalUp,
        auditXpReceived: results.data.user[0].totalDown,
        totalXp,
    };

    return userData;
};

// Fetch XP by project data from the server
const getXpByProject = async (userToken) => {
    const query = `
        query GetXpByProject($type: String!) {
            transaction(
                where: {
                    path: { _regex: "^\\/johvi\\/div-01\\/[-\\\\w]+$" }
                    type: { _eq: $type }
                },
                order_by: { amount: asc }
            ) {
                amount
                path
            }
        }
    `;
    const queryBody = {
        query,
        variables: {
            type: "xp",
        },
    };

    const results = await getQueryResults(queryBody, userToken);

    // Process transaction data to extract XP by project
    const pathStart = "/johvi/div-01/";

    const xpByProjectData = results.data.transaction.map((transaction) => {
        const updatedPath = transaction.path.replace(pathStart, "");
        return { ...transaction, path: updatedPath };
    });

    // Aggregate XP amounts by project path
    let data = xpByProjectData.reduce((acc, curr) => {
        const item = curr.path.split("/")[0];
        acc.set(item, acc.get(item) ? acc.get(item) + curr.amount : curr.amount);
        return acc;
    }, new Map());

    data = Array.from(data).map(([key, value]) => {
        return { path: key, amount: value };
    });
    data.sort((a, b) => a.amount - b.amount);

    return data;
};

// Fetch user progress data from the server
const getUserProgress = async (userToken) => {
    const query = `
        {
            transaction(
                where: {
                    path: { _regex: "^\\/johvi\\/div-01\\/[-\\\\w]+$" }
                    type: { _eq: "xp" }
                },
                order_by: { createdAt: asc }
            ) {
                amount
                createdAt
                path
            }
        }
    `;

    const queryBody = {
        query: query,
    };

    const results = await getQueryResults(queryBody, userToken);

    return results.data.transaction;
};

// Fetch audit details data from the server
const getAuditDetails = async (userToken) => {
    const query = `
        query {
            transaction(where: { _or: [{ type: { _eq: "up" } }, { type: { _eq: "down" } }] }) {
                amount
                type
                path
            }
        }
    `;

    const queryBody = {
        query,
    };

    const results = await getQueryResults(queryBody, userToken);

    // Process audit details data
    const auditDetailsData = results.data.transaction.map((transaction) => ({
        amount: transaction.amount,
        type: transaction.type,
        path: transaction.path,
    }));

    // Aggregate audit details by type (up/down)
    let data = auditDetailsData.reduce((acc, curr) => {
        const item = curr.type === 'up' ? 'Audits Earned' : 'Audits Received';
        acc.set(item, acc.get(item) ? acc.get(item) + curr.amount : curr.amount);
        return acc;
    }, new Map());

    data = Array.from(data).map(([key, value]) => {
        return { path: key, amount: value };
    });

    return data;
};

// Perform GraphQL query and return results
const getQueryResults = async (queryBody, userToken) => {
    const url = "https://01.kood.tech/api/graphql-engine/v1/graphql";

    const options = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + userToken,
        },
        body: JSON.stringify(queryBody),
    };

    try {
        const response = await fetch(url, options);
        if (response.ok) {
            const result = await response.json();
            return result;
        } else {
            const statusMsg = await response.text();
            return statusMsg;
        }
    } catch (error) {
        console.error(error);
    }
};

// Create and display user data on the profile page
const createUserData = (data) => {
    document.getElementById("userDetails").innerHTML = `
        <h1 id="username">${data.username}</h1>
        <p>Name: ${data.firstName} ${data.lastName}</p>
        <p>Email: ${data.email}</p>
        <p>Campus: ${data.campus}</p>
        <p>Location: ${data.attrs.addressCity}, ${data.attrs.addressCountry}</p>
        <p>Age: ${calculateAge(data.attrs.dateOfBirth)}</p>
    `;
};

// Create and display total XP amount information
const createXpAmountInfo = (totalXp) => {
    document.getElementById("xpAmountInfo").innerHTML = `
        <h1>XP amount</h1>
        <p>Total: ${format2(totalXp, true)}</p>
    `;
};

// Create and display audit details
const createAuditDetails = (data) => {
    document.getElementById("auditDetails").innerHTML = `
        <h1>Audit Details</h1>
        <p>Audits earned: ${format2(data.auditXpDone, true)}</p>
        <p>Audits received: ${format2(data.auditXpReceived, true)}</p>
        <p>Audit ratio: ${format2(data.auditRatio)}</p>
        <svg id="auditGraph" width="100%" height="100%"></svg>
    `;
};

// Calculate age from date of birth
const calculateAge = (dob) => {
    const dateOfBirth = new Date(dob);
    const currentDate = new Date();

    let age = currentDate - dateOfBirth;
    age = Math.floor(age / 31556952000); // Milliseconds to years

    return age;
};

// Format numbers with optional unit (kB or MB)
const format2 = (number, unit = false) => {
    number = Number(number);
    if (unit) {
        if (number < 1000000) {
            number = number / 1000;
            unit = " kB";
        } else {
            number = number / 1000000;
            unit = " MB";
        }
    }
    let rounded = number.toFixed(2);
    if (rounded == 0) {
        rounded = "0";
    } else {
        rounded = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toString();
    }
    return rounded + (unit ? unit : "");
};

// Initialize the application on window load
window.onload = () => {
    addLoginFunctionality();
    loadUserProfile();
};

// Attempt login with provided credentials
const attemptLogin = async (username, password) => {
    console.log("Attempting to log in with credentials:", username);
    const url = "https://01.kood.tech/api/auth/signin";
    const options = {
        method: "POST",
        headers: {
            "Content-Type": "text/plain",
            "Content-Encoding": "base64",
            Authorization: "Basic " + btoa(`${username}:${password}`),
        },
    };

    try {
        const response = await fetch(url, options);
        console.log("Login response received:", response);
        handleLoginResponse(response);
    } catch (error) {
        console.error("Login error:", error);
    }
};

// Handle login response from the server
const handleLoginResponse = async (response) => {
    if (response.ok) {
        const result = await response.json();
        sessionStorage.setItem("JWT", result);
        loadUserProfile();
    } else {
        document.getElementById("password-error").innerHTML =
            "Login credentials invalid, please try again";
    }
};

// Add functionality to the login form
const addLoginFunctionality = () => {
    const loginForm = document.getElementById("loginForm");
    const username = document.getElementById("username");
    const password = document.getElementById("password");
    const inputs = document.querySelectorAll("input");
    const loginButton = document.getElementById("loginButton");

    // Enable login button only if both fields are filled
    inputs.forEach((input) => {
        input.addEventListener("input", () => {
            if (input.value)
                document.getElementById(`${input.id}-error`).innerHTML = "";
            if (username.value && password.value) {
                loginButton.disabled = false;
            } else {
                loginButton.disabled = true;
            }
        });
    });

    // Handle form submission
    loginForm.addEventListener("submit", (event) => {
        event.preventDefault();

        // Validate form inputs
        inputs.forEach((input) => {
            if (!input.value) {
                document.getElementById(
                    `${input.id}-error`
                ).innerHTML = `This field is required`;
            }
        });
        if (username.value && password.value) {
            attemptLogin(username.value, password.value);
        }
    });
};

addLoginFunctionality();
