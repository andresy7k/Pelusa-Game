package com.pelusa.application.dto;

/**
 * Partida recién creada + el token secreto del dispositivo que la creó. El
 * token NO va en {@link GameView} (que es público: cualquiera puede leer el
 * estado); el controller lo entrega en la cabecera {@code X-Game-Token}.
 */
public record IssuedGame(GameView game, String token) {}
