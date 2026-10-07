package com.pelusa.infrastructure.web;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;

/**
 * Errores consistentes RFC7807 (API_CONTRACT §error canónico).
 * Phase 2: base. Los errorCode de dominio (NOT_YOUR_TURN...) llegan en Phase 4.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

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
