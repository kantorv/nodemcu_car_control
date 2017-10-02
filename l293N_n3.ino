#include <math.h>
#include <ESP8266WiFi.h>          //https://github.com/esp8266/Arduino
//needed for library
#include <DNSServer.h>
#include <ESP8266WebServer.h>
#include "WiFiManager.h"          //https://github.com/tzapu/WiFiManager


#include <ESP8266mDNS.h>
#include <ESP8266HTTPUpdateServer.h> //http://esp8266.github.io/Arduino/versions/2.0.0/doc/ota_updates/ota_updates.html#web-browser
ESP8266HTTPUpdateServer httpUpdater;

//https://diyprojects.io/esp8266-web-server-part-1-store-web-interface-spiffs-area-html-css-js/
#include <FS.h>

#define LED     D4 // internal led, check on your device, it may be D0 on some nodemcu boards

//reset wifi settings button
#define RESET_BUTTON D1
int buttonState = 0;

WiFiManager wifiManager;
ESP8266WebServer server (80);


//L298N H Bridge connection
// some technical background: http://dronebotworkshop.com/dc-motors-l298n-h-bridge/

const int enA = D2; //pwm
const int enB = D3; //pwm

const int in1 = D5;
const int in2 = D6;
const int in3 = D7;
const int in4 = D8;

const char* host = "nodemcu_car"; //TODO: some unique id

int last_direction = 0;
int last_ena = 0;
int last_enb = 0;

void configModeCallback (WiFiManager *myWiFiManager) {
  Serial.println("Entered config mode");
  Serial.println(WiFi.softAPIP());
  //if you used auto generated SSID, print it
  Serial.println(myWiFiManager->getConfigPortalSSID());
}

void reset_settings() {
      Serial.println("Resetting settings");
      wifiManager.resetSettings();
}

void handleNotFound() {
  String message = "File Not Found\n\n";
  message += "URI: ";
  message += server.uri();
  message += "\nMethod: ";
  message += ( server.method() == HTTP_GET ) ? "GET" : "POST";
  message += "\nArguments: ";
  message += server.args();
  message += "\n";

  for ( uint8_t i = 0; i < server.args(); i++ ) {
    message += " " + server.argName ( i ) + ": " + server.arg ( i ) + "\n";
  }
  server.send ( 404, "text/plain", message );
}

void setup ( void ) {
  Serial.begin(115200);
  pinMode(RESET_BUTTON, INPUT_PULLUP);
  digitalWrite(RESET_BUTTON, 1);

  pinMode(LED, OUTPUT);
  digitalWrite(LED, LOW); // "on" on setup, blinks 5 times  on successful start, then off
  

  pinMode(enA, OUTPUT);
  pinMode(enB, OUTPUT);
  pinMode(in1, OUTPUT);
  pinMode(in2, OUTPUT);
  pinMode(in3, OUTPUT);
  pinMode(in4, OUTPUT);

  digitalWrite(in1, LOW);
  digitalWrite(in2, LOW);
  digitalWrite(in3, LOW);
  digitalWrite(in4, LOW);
  analogWrite(enA, 0);
  analogWrite(enB, 0);
  //WiFiManager
  //Local intialization. Once its business is done, there is no need to keep it around

  //reset settings - for testing
  // wifiManager.resetSettings();

  //set callback that gets called when connecting to previous WiFi fails, and enters Access Point mode
  wifiManager.setAPCallback(configModeCallback);

  //fetches ssid and pass and tries to connect
  //if it does not connect it starts an access point with the specified name
  //here  "AutoConnectAP"
  //and goes into a blocking loop awaiting configuration
  if(!wifiManager.autoConnect()) {
    Serial.println("failed to connect and hit timeout");
    //reset and try again, or maybe put it to deep sleep
    ESP.reset();
    delay(1000);
  }

 if (!SPIFFS.begin())
  {
    blinkLed(10,50);
    // Serious problem
    Serial.println("SPIFFS Mount failed");
  } else {
    blinkLed(3,100);
    Serial.println("SPIFFS Mount succesfull");
  }



  // web updater requirements
  MDNS.begin(host); 
  httpUpdater.setup(&server);

  
  
  //locally stored static content
  server.serveStatic("/", SPIFFS, "/index.html");
  server.serveStatic("/img", SPIFFS, "/img");
  server.serveStatic("/js", SPIFFS, "/js");
  server.serveStatic("/css", SPIFFS, "/css");
  
  
  server.on ( "/pwm", handleMotorsPwm );
  server.on ( "/settings", retreiveCurrentSettings );
  server.on ( "/ping", []() {
    server.send ( 200, "text/plain", "pong" ); // sample output
  });

  server.onNotFound ( handleNotFound );
  server.begin();
  Serial.println ( "HTTP server started" );
  blinkLed(5,100);


  // web updater requirements
  MDNS.addService("http", "tcp", 80);
  Serial.printf("HTTPUpdateServer ready! Open http://%s.local/update in your browser\n", host);
}



void blinkLed(int times, int delay_millis){
    for (int i=0;i<times;i++){
      digitalWrite(LED, LOW);
      delay(delay_millis);
      digitalWrite(LED, HIGH);
      delay(delay_millis);
  }
}

void loop ( void ) {
  buttonState = digitalRead(RESET_BUTTON);
  // is configuration portal requested?
  if (buttonState == LOW) {
      reset_settings();
      delay(1000);
  }
  server.handleClient();
}




String getValue(String data, char separator, int index)
{
    int found = 0;
    int strIndex[] = { 0, -1 };
    int maxIndex = data.length() - 1;

    for (int i = 0; i <= maxIndex && found <= index; i++) {
        if (data.charAt(i) == separator || i == maxIndex) {
            found++;
            strIndex[0] = strIndex[1] + 1;
            strIndex[1] = (i == maxIndex) ? i+1 : i;
        }
    }
    return found > index ? data.substring(strIndex[0], strIndex[1]) : "";
}





 
void handleMotorsPwm(){
    int ena = 0;
    int enb = 0;
    int direction = 0;
    String rand = "";
    //TODO: get all variables without loops
    for ( uint8_t i = 0; i < server.args(); i++ ) {
      if( server.argName ( i )  == "ena"){
         ena =  server.arg ( i ).toInt() ;
      }
      if( server.argName ( i )  == "enb"){
         enb =  server.arg ( i ).toInt() ;
      }
      if( server.argName ( i )  == "direction"){
         direction =  server.arg ( i ).toInt() ;
      }

      if( server.argName ( i )  == "rand"){
         rand =  server.arg ( i ) ;
      }
    }

    if(direction != last_direction){
        if(direction > 0){
        digitalWrite(in1, LOW);
        digitalWrite(in2, HIGH);  
        digitalWrite(in3, LOW);
        digitalWrite(in4, HIGH);
      }
      else{
        digitalWrite(in1, HIGH);
        digitalWrite(in2, LOW);  
        digitalWrite(in3, HIGH);
        digitalWrite(in4, LOW);
      }
      last_direction = direction;
    }

    if(ena != last_ena){
      analogWrite(enA, ena);
      last_ena = ena;
    }
    
    if(enb != last_enb){
      analogWrite(enB, enb);
      last_enb = enb;
    }

    unsigned long time;
    time = millis();
    
    String message =  "{\"result\":\"OK\",\"rand\":\""+rand+"\",\"ena\":"+String(ena)+",\"enb\":"+String(enb) + ",\"millis\":"+String(time) + ",\"direction\":"+String(direction) + "}";
    server.send ( 200, "application/json", message );
    
}


void stopMotors(){
  digitalWrite(in1, LOW);
  digitalWrite(in2, LOW);  
  digitalWrite(in3, LOW);
  digitalWrite(in4, LOW);
  analogWrite(enA, 0);
  analogWrite(enB, 0);
        
}

void retreiveCurrentSettings(){
  String message =  "{\"result\":\"OK\",\"ena\":\""+String(last_ena)+",\"enb\":\""+String(last_enb)+",\"direction\":\""+String(last_direction)+"\"}";
   server.send ( 200, "application/json", message );
}


