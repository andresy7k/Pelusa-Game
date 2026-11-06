# Render Free: build con Maven (JDK 25 LTS) y runtime JRE 25 LTS liviano.
# Contexto del build = backend/ (render.yaml: dockerContext).
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q package -DskipTests

FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build /app/target/pelusa-game-0.1.0-SNAPSHOT.jar app.jar
EXPOSE 8080
# Render Free da 512 MB. Por defecto la JVM toma solo el 25 % como heap (~128 MB):
# MaxRAMPercentage=75 deja ~384 MB y SerialGC es el colector más liviano para 1 CPU.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75 -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError"
ENTRYPOINT ["java", "-jar", "app.jar"]
