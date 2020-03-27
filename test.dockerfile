FROM node:alpine

#COPY things from build context into container
COPY . /
#RUN a bash command
RUN npm install -g \
mysql \
express \
http \
path \
fs \
jsonwebtoken \
cookie-session
#Recommed ports that are supposed to be open 
EXPOSE 8080
#default command
CMD node app.js