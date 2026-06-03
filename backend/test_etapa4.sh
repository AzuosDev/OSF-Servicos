#!/usr/bin/env bash
set -e
url=http://127.0.0.1:3000
register_response=$(curl -sS -X POST "$url/api/auth/register" -H 'Content-Type: application/json' -d '{"email":"test@contacerta.local","password":"Test1234"}')
echo "REGISTER:$register_response"
login_response=$(curl -sS -X POST "$url/api/auth/login" -H 'Content-Type: application/json' -d '{"email":"test@contacerta.local","password":"Test1234"}')
echo "LOGIN:$login_response"
access_token=$(echo "$login_response" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.accessToken)")
refresh_token=$(echo "$login_response" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.refreshToken)")
echo "ACCESS_TOKEN:$access_token"
echo "REFRESH_TOKEN:$refresh_token"
category_response=$(curl -sS -X POST "$url/api/categories" -H 'Content-Type: application/json' -H "Authorization: Bearer $access_token" -d '{"name":"Teste Categoria","icon":"Star","color":"#123ABC"}')
echo "CATEGORY_CREATE:$category_response"
transaction_income=$(curl -sS -X POST "$url/api/transactions" -H 'Content-Type: application/json' -H "Authorization: Bearer $access_token" -d '{"type":"INCOME","value":1000.5,"date":"2026-06-03T12:00:00.000Z"}')
echo "TRANSACTION_INCOME:$transaction_income"
pending_response=$(curl -sS -X POST "$url/api/pending" -H 'Content-Type: application/json' -H "Authorization: Bearer $access_token" -d '{"title":"Conta teste","value":200.25,"dueDate":"2026-06-30T00:00:00.000Z"}')
echo "PENDING_CREATE:$pending_response"
goal_response=$(curl -sS -X POST "$url/api/goals" -H 'Content-Type: application/json' -H "Authorization: Bearer $access_token" -d '{"name":"Meta teste","targetValue":500,"currentValue":250}')
echo "GOAL_CREATE:$goal_response"
categories_list=$(curl -sS -X GET "$url/api/categories" -H "Authorization: Bearer $access_token")
echo "CATEGORIES_LIST:$categories_list"
transactions_list=$(curl -sS -X GET "$url/api/transactions?page=1&limit=5" -H "Authorization: Bearer $access_token")
echo "TRANSACTIONS_LIST:$transactions_list"
pending_list=$(curl -sS -X GET "$url/api/pending?paid=false" -H "Authorization: Bearer $access_token")
echo "PENDING_LIST:$pending_list"
goals_list=$(curl -sS -X GET "$url/api/goals" -H "Authorization: Bearer $access_token")
echo "GOALS_LIST:$goals_list"
refresh_response=$(curl -sS -X POST "$url/api/auth/refresh" -H 'Content-Type: application/json' -d "{\"refreshToken\":\"$refresh_token\"}")
echo "REFRESH:$refresh_response"
logout_response=$(curl -sS -X POST "$url/api/auth/logout" -H 'Content-Type: application/json' -H "Authorization: Bearer $access_token" -d "{\"refreshToken\":\"$refresh_token\"}")
echo "LOGOUT:$logout_response"
