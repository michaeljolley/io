import express = require('express');
export declare class User {
    app: express.Application;
    private http;
    private users;
    private usersUrl;
    private userDb;
    constructor();
    start(): void;
    private loadRoutes;
    private getUser;
    private listen;
}
