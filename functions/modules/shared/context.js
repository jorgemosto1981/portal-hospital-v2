"use strict";

const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const auth = getAuth();

module.exports = {
  db,
  auth,
  FieldValue,
  Timestamp,
};

