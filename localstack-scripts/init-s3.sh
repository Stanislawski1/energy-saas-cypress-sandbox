#!/bin/bash
echo "Initializing local S3 bucket for Cypress tests..."

# Create a fake S3 bucket
awslocal s3 mb s3://cypress-reports-bucket

# Set public read access
awslocal s3api put-bucket-acl --bucket cypress-reports-bucket --acl public-read

echo "S3 bucket 'cypress-reports-bucket' created successfully."
