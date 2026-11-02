package com.pelusa.infrastructure.web;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;

/**
 * Errores consistentes RFC7807 (API_CONTRACT §error canónico).
 * Mapea códigos de dominio → status: 404 no existe, 409 conflicto de turno,
 * 422 regla violada, 400 validación. Phase 4 añade los códigos de juego.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  private static final Set<String> NOT_FOUND =
      Set.of("GAME_NOT_FOUND", "CODE_NOT_FOUND");
  private static final Set<String> CONFLICT =
      Set.of("GAME_FINISHED", "GAME_NOT_FINISHED", "NOT_YOUR_TURN", "ALREADY_STARTED",
          "ALREADY_STASHED_THIS_TURN", "CONCURRENT_TURN", "CODE_COLLISION",
          "GAME_FULL", "NAME_TAKEN", "NOT_HOST", "NOT_ENOUGH_PLAYERS", "TURN_EXPIRED");
  // Cualquier otro código de dominio cae en el default 422 (regla violada):
  // DECK_EMPTY, NO_STASHABLE_CARDS, NO_STEALABLE_CARDS, STEAL_VALUE_MISMATCH,
  // INVALID_PLAYER.

  @ExceptionHandler(com.pelusa.domain.engine.DomainException.class)
  public ProblemDetail domain(com.pelusa.domain.engine.DomainException e, HttpServletRequest req) {
    HttpStatus status = HttpStatus.UNPROCESSABLE_ENTITY;
    if (NOT_FOUND.contains(e.getCode())) {
      status = HttpStatus.NOT_FOUND;
    } else if (CONFLICT.contains(e.getCode())) {
      status = HttpStatus.CONFLICT;
    } else if ("VALIDATION_FAILED".equals(e.getCode())) {
      status = HttpStatus.BAD_REQUEST;
    }
    return problem(status, e.getCode(), e.getMessage(), req);
  }

  @ExceptionHandler(OptimisticLockingFailureException.class)
  public ProblemDetail concurrent(OptimisticLockingFailureException e, HttpServletRequest req) {
    return problem(HttpStatus.CONFLICT, "CONCURRENT_TURN", "Otro request modificó la partida, reintenta", req);
  }

  @ExceptionHandler(org.springframework.web.bind.MethodArgumentNotValidException.class)
  public ProblemDetail beanValidation(org.springframework.web.bind.MethodArgumentNotValidException e,
      HttpServletRequest req) {
    return problem(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Request inválido", req);
  }

  @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
  public ProblemDetail unsupportedMedia(HttpMediaTypeNotSupportedException e, HttpServletRequest req) {
    return problem(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE",
        "Content-Type no soportado: usá application/json", req);
  }

  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ProblemDetail unreadable(HttpMessageNotReadableException e, HttpServletRequest req) {
    return problem(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Body JSON inválido o malformado", req);
  }

  @ExceptionHandler(MethodArgumentTypeMismatchException.class)
  public ProblemDetail typeMismatch(MethodArgumentTypeMismatchException e, HttpServletRequest req) {
    return problem(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED",
        "Parámetro inválido: " + e.getName(), req);
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ProblemDetail illegalArgument(IllegalArgumentException e, HttpServletRequest req) {
    return problem(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", e.getMessage(), req);
  }

  @ExceptionHandler(NoHandlerFoundException.class)
  public ProblemDetail notFound(NoHandlerFoundException e, HttpServletRequest req) {
    return problem(HttpStatus.NOT_FOUND, "NOT_FOUND", "Recurso no existe", req);
  }

  @ExceptionHandler(Exception.class)
  public ProblemDetail unexpected(Exception e, HttpServletRequest req) {
    // Un 500 nunca debe ser mudo: dejamos el stacktrace con el requestId para correlacionar.
    log.error("Error inesperado en {} {}", req.getMethod(), req.getRequestURI(), e);
    return problem(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL", "Error inesperado", req);
  }

  private ProblemDetail problem(HttpStatus status, String errorCode, String detail, HttpServletRequest req) {
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detail);
    pd.setType(URI.create("https://pelusa/errors/" + errorCode));
    pd.setTitle(status.getReasonPhrase());
    pd.setInstance(URI.create(req.getRequestURI()));
    pd.setProperty("errorCode", errorCode);
    String rid = MDC.get("requestId");
    if (rid != null) {
      pd.setProperty("requestId", rid);
    }
    return pd;
  }
}
