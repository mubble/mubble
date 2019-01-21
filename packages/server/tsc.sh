#!/bin/bash

cd ../core
echo "Compiling Core Package"
tsc
cd ../server
echo "Compiling Server Package"
tsc