# CURL — probar todos los endpoints

Backend en `http://localhost:8080` (perfil por defecto) o `http://localhost:8081`
(perfil `e2e`). Los ejemplos usan bash (Git Bash en Windows). En PowerShell use
`curl.exe` y comillas dobles escapadas, o el bloque PowerShell del final.

```bash
API=http://localhost:8080
```

## 1. Salud

```bash
curl -i $API/api/health          # 200 {"status":"UP"} (no toca la BD)
curl -i $API/api/ping            # 204 (keep-alive)
curl -i $API/actuator/health     # 200 con chequeo real de la BD
```

## 2. Crear partida (hotseat) — `POST /api/games` → 201

```bash
curl -s -X POST $API/api/games -H 'Content-Type: application/json' \
  -d '{"names":["Ana","Beto"],"firstPlayerIndex":0}' | tee /tmp/game.json
GAME=$(sed -E 's/.*"id":"([^"]+)".*/\1/;q' /tmp/game.json)
ANA=$(grep -o '"players":\[{"id":"[^"]*' /tmp/game.json | sed 's/.*"id":"//')
BETO=$(grep -o '"seat":0},{"id":"[^"]*' /tmp/game.json | sed 's/.*"id":"//')
echo "$GAME $ANA $BETO"
```

Respuesta: `status: CREATED`, `deckRemaining: 110`, `players[]`, frentes vacíos.
Errores: 400 `VALIDATION_FAILED` (menos de 2 o más de 6 nombres, nombres repetidos,
`firstPlayerIndex` fuera de rango).

```bash
curl -i -X POST $API/api/games -H 'Content-Type: application/json' -d '{"names":["Ana","Ana"]}'   # 400
```

## 3. Iniciar — `POST /api/games/{id}/start` → 200

```bash
curl -s -X POST $API/api/games/$GAME/start
curl -i -X POST $API/api/games/$GAME/start        # 409 ALREADY_STARTED
```

## 4. Consultar estado y jugadores

```bash
curl -s $API/api/games/$GAME                       # estado completo
curl -s $API/api/games/$GAME/players               # [{id,name,seat,currentTurn,front,stashedSum}]
curl -i $API/api/games/00000000-0000-0000-0000-000000000000   # 404 GAME_NOT_FOUND
curl -i $API/api/games/no-es-uuid                  # 400 VALIDATION_FAILED
```

## 5. Turno: sacar, plantarse, guardar, robar

Todas las acciones reciben `{"playerId": "..."}` y aceptan la cabecera opcional
`Idempotency-Key` (1–64 caracteres): repetir la misma clave devuelve el estado sin
volver a actuar.

```bash
# Sacar carta (buscar pelusa)
curl -s -X POST $API/api/games/$GAME/draw -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: draw-1' -d "{\"playerId\":\"$ANA\"}"

# Reintento con la misma clave: mismo estado, no saca otra carta
curl -s -X POST $API/api/games/$GAME/draw -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: draw-1' -d "{\"playerId\":\"$ANA\"}"

# Fuera de turno → 409 NOT_YOUR_TURN
curl -i -X POST $API/api/games/$GAME/draw -H 'Content-Type: application/json' -d "{\"playerId\":\"$BETO\"}"

# Plantarse (finalizar voluntariamente) → el turno pasa a Beto
#   422 MUST_DRAW_FIRST si todavía no sacó ninguna carta en este turno
curl -s -X POST $API/api/games/$GAME/stand -H 'Content-Type: application/json' -d "{\"playerId\":\"$ANA\"}"

# Beto saca y luego intenta robar el valor que sacó (value = lastDrawnValue)
curl -s -X POST $API/api/games/$GAME/draw -H 'Content-Type: application/json' -d "{\"playerId\":\"$BETO\"}"
curl -i -X POST $API/api/games/$GAME/steal -H 'Content-Type: application/json' \
  -d "{\"playerId\":\"$BETO\",\"value\":4}"
#   200 si Ana tiene ese valor delante y es la última carta que sacó Beto
#   422 STEAL_VALUE_MISMATCH si value ≠ última carta sacada
#   422 NO_STEALABLE_CARDS   si nadie tiene ese valor delante
curl -s -X POST $API/api/games/$GAME/stand -H 'Content-Type: application/json' -d "{\"playerId\":\"$BETO\"}"

# Guardar (stash): al inicio del turno, antes de sacar → frente a puntos
curl -s -X POST $API/api/games/$GAME/stash -H 'Content-Type: application/json' -d "{\"playerId\":\"$ANA\"}"
#   409 ALREADY_STASHED_THIS_TURN si se repite; 422 NO_STASHABLE_CARDS si no hay frente o ya sacó
```

## 6. Resultado e histórico

```bash
curl -i $API/api/games/$GAME/result                # 409 GAME_NOT_FINISHED mientras se juega
curl -s "$API/api/games/history?page=0&size=20"    # partidas FINISHED (máx size=50)
curl -i "$API/api/games/history?size=51"           # 400
```

Cada elemento del histórico trae `id`, `createdAt`, `startedAt`, `finishedAt`,
`players`, y `result {winnerId, tie, reason, scores[{name,sum,countsByValue}]}`.

## 7. Multijugador online

```bash
curl -s -X POST $API/api/games/online -H 'Content-Type: application/json' \
  -d '{"name":"Ana","capacity":2}' | tee /tmp/room.json      # 201: {game:{code,...}, playerId}
CODE=$(grep -o '"code":"[^"]*' /tmp/room.json | sed 's/"code":"//')
ROOM=$(grep -o '"game":{"id":"[^"]*' /tmp/room.json | sed 's/.*"id":"//')
HOST=$(grep -o '"playerId":"[^"]*' /tmp/room.json | tail -1 | sed 's/"playerId":"//')

curl -s -X POST $API/api/games/join -H 'Content-Type: application/json' \
  -d "{\"code\":\"$CODE\",\"name\":\"Beto\"}"                   # 200, spectator:false
curl -i -X POST $API/api/games/join -H 'Content-Type: application/json' \
  -d '{"code":"ZZZZZZ","name":"Ceci"}'                          # 404 CODE_NOT_FOUND
curl -i -X POST $API/api/games/$ROOM/start -H 'Content-Type: application/json' -d '{}'   # 409 NOT_HOST
curl -s -X POST $API/api/games/$ROOM/start -H 'Content-Type: application/json' \
  -d "{\"playerId\":\"$HOST\"}"                                 # 200, turnDeadlineAt = +15 s
# Cada draw del jugador en turno vuelve a poner turnDeadlineAt = ahora + 15 s.
```

## 8. Soporte de pruebas (solo perfil `e2e`)

```bash
API=http://localhost:8081   # java -jar target/pelusa-game-0.1.0-SNAPSHOT.jar --spring.profiles.active=e2e
curl -i -X POST $API/api/test/games/$GAME/deck -H 'Content-Type: application/json' \
  -d '{"values":[2,5,9,5]}'          # 204: esas cartas salen primero (composición intacta)
curl -i -X POST $API/api/test/games/$GAME/deck -H 'Content-Type: application/json' \
  -d '{"values":[5,1],"truncate":true}'   # 204: el mazo queda solo con esas 2
```

Con el perfil por defecto esa ruta responde 404: el bean no existe.

## PowerShell (equivalente mínimo)

```powershell
$api = "http://localhost:8080"
$g = Invoke-RestMethod -Method Post "$api/api/games" -ContentType "application/json" -Body '{"names":["Ana","Beto"]}'
Invoke-RestMethod -Method Post "$api/api/games/$($g.id)/start" -ContentType "application/json" -Body '{}'
$ana = $g.players[0].id
Invoke-RestMethod -Method Post "$api/api/games/$($g.id)/draw" -ContentType "application/json" -Body (@{playerId=$ana} | ConvertTo-Json)
```
