package com.pelusa.infrastructure.web.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/** Acción de turno: quién actúa (el backend verifica que sea su turno). */
public record ActRequest(@NotNull UUID playerId) {}
