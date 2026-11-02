package com.pelusa.infrastructure.web.dto;

import java.util.UUID;

/** Quién pide empezar: en sala ONLINE debe ser el host. null = llamada local/hotseat. */
public record StartRequest(UUID playerId) {}
