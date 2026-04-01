import { useState, useRef, useEffect, useCallback } from "react";

const STEPS = [
  {
    id: "json-to-request",
    phase: "Deserialización",
    title: "JSON → EstudianteRequest",
    actor: "Jackson ObjectMapper (@RequestBody)",
    desc: "Spring detecta @RequestBody y usa Jackson para convertir el JSON del body en un objeto Java. Mapeo automático 1:1 por nombre de propiedad.",
    code: `@PostMapping("/save")
public ResponseEntity<ApiResponse<EstudianteResponse>> save(
    @Valid @RequestBody EstudianteRequest request) {
    // Jackson ya deserializó el JSON → request
    EstudianteResponse response = estudianteService
        .saveEstudiante(request);
    ...
}`,
    left: {
      label: "JSON (POST body)",
      badge: "JSON",
      badgeCls: "bg-neutral-700 text-neutral-100",
      fields: [
        { name: '"dni"', val: '"74850912"', color: "sky" },
        { name: '"carreraId"', val: "1", color: "amber" },
        { name: '"telefono"', val: '"987654321"', color: "teal" },
        { name: '"email"', val: '"juan@mail.com"', color: "violet" },
      ],
    },
    right: {
      label: "EstudianteRequest",
      badge: "DTO",
      badgeCls: "bg-sky-600 text-white",
      fields: [
        { name: "String dni", val: '"74850912"', color: "sky", ann: "@NotBlank @Pattern(8d)" },
        { name: "Long carreraId", val: "1", color: "amber", ann: "@NotNull" },
        { name: "String telefono", val: '"987654321"', color: "teal", ann: "@NotBlank" },
        { name: "String email", val: '"juan@mail.com"', color: "violet", ann: "@NotBlank @Email" },
      ],
    },
    mappings: [
      { l: 0, r: 0, color: "sky" },
      { l: 1, r: 1, color: "amber" },
      { l: 2, r: 2, color: "teal" },
      { l: 3, r: 3, color: "violet" },
    ],
    insight: "Jackson busca setters que coincidan con los keys del JSON. Si un campo no coincide, se ignora silenciosamente.",
  },
  {
    id: "validation",
    phase: "Validación @Valid",
    title: "Bean Validation → ¿pasa o falla?",
    actor: "Hibernate Validator (javax.validation)",
    desc: "Inmediatamente después de deserializar, Spring ejecuta las validaciones del DTO. Si alguna falla, NUNCA se llega al Controller — Spring lanza MethodArgumentNotValidException antes.",
    code: `// EstudianteRequest.java — Las anotaciones que se validan:
@NotBlank(message = "El DNI es obligatorio")
@Pattern(regexp = "^\\\\d{8}$",
    message = "DNI debe tener exactamente 8 dígitos")
private String dni;

@NotNull(message = "La carrera es obligatoria")
private Long carreraId;

@NotBlank(message = "El teléfono es obligatorio")
private String telefono;

@NotBlank(message = "El email es obligatorio")
@Email(message = "Formato no válido")
private String email;`,
    left: {
      label: "EstudianteRequest",
      badge: "DTO",
      badgeCls: "bg-sky-600 text-white",
      fields: [
        { name: "dni", val: '"74850912"', color: "sky", ann: "@NotBlank @Pattern" },
        { name: "carreraId", val: "1", color: "amber", ann: "@NotNull" },
        { name: "telefono", val: '"987654321"', color: "teal", ann: "@NotBlank" },
        { name: "email", val: '"juan@mail.com"', color: "violet", ann: "@Email" },
      ],
    },
    right: {
      label: "Resultado de validación",
      badge: "CHECK",
      badgeCls: "bg-emerald-600 text-white",
      fields: [
        { name: "dni", val: "✓ 8 dígitos numéricos", color: "emerald" },
        { name: "carreraId", val: "✓ no es null", color: "emerald" },
        { name: "telefono", val: "✓ no está en blanco", color: "emerald" },
        { name: "email", val: "✓ formato válido", color: "emerald" },
      ],
    },
    mappings: [
      { l: 0, r: 0, color: "emerald" },
      { l: 1, r: 1, color: "emerald" },
      { l: 2, r: 2, color: "emerald" },
      { l: 3, r: 3, color: "emerald" },
    ],
    error: {
      trigger: "Cualquier campo falla la validación",
      exception: "MethodArgumentNotValidException",
      handler: "@ExceptionHandler(MethodArgumentNotValidException.class)",
      status: "400 Bad Request",
      statusColor: "rose",
      code: `@ExceptionHandler(MethodArgumentNotValidException.class)
public ResponseEntity<ApiResponse<Map<String, List<String>>>>
    handleMethodArgumentNotValid(
        MethodArgumentNotValidException ex) {
    Map<String, List<String>> fieldErrors = new HashMap<>();
    for (FieldError error : ex.getBindingResult()
            .getFieldErrors()) {
        fieldErrors
            .computeIfAbsent(error.getField(),
                k -> new ArrayList<>())
            .add(error.getDefaultMessage());
    }
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(new ApiResponse<>(
            false, "Error en validacion", fieldErrors
        ));
}`,
      response: `{
  "success": false,
  "message": "Error en validacion",
  "data": {
    "dni": ["DNI debe tener exactamente 8 digitos"],
    "email": ["Formato no valido"]
  }
}`,
      details: [
        "Spring intercepta ANTES de llegar al Controller",
        "Agrupa todos los errores por campo (no falla en el primero)",
        "Usa computeIfAbsent para múltiples errores por campo",
        "La respuesta mantiene la estructura ApiResponse<T>",
      ],
    },
    insight: "Esto ocurre en la capa de Spring MVC, ANTES del Controller. Si falla, el método save() del Controller nunca se ejecuta.",
  },
  {
    id: "request-to-entity",
    phase: "ModelMapper (STRICT)",
    title: "EstudianteRequest → EstudianteEntity",
    actor: "modelMapper.map(request, entity)",
    desc: "ModelMapper en modo STRICT solo copia campos con nombre y tipo idénticos. Tres campos quedan vacíos porque no existen en el Request o son tipos incompatibles.",
    code: `EstudianteEntity estudiante = new EstudianteEntity();
modelMapper.map(estudianteRequest, estudiante);
// Solo mapea: dni, telefono, email
// NO mapea: id (auto), nombres/apellidos (no existen),
//           carrera (Long ≠ CarreraEntity)`,
    left: {
      label: "EstudianteRequest",
      badge: "DTO",
      badgeCls: "bg-sky-600 text-white",
      fields: [
        { name: "String dni", val: '"74850912"', color: "sky" },
        { name: "Long carreraId", val: "1", color: "amber" },
        { name: "String telefono", val: '"987654321"', color: "teal" },
        { name: "String email", val: '"juan@mail.com"', color: "violet" },
      ],
    },
    right: {
      label: "EstudianteEntity",
      badge: "ENTITY",
      badgeCls: "bg-emerald-600 text-white",
      fields: [
        { name: "UUID id", val: "null", color: "neutral", skip: "Autogenerado por JPA al persistir" },
        { name: "String nombres", val: "null", color: "orange", skip: "No existe en Request → viene de RENIEC" },
        { name: "String apellidos", val: "null", color: "orange", skip: "No existe en Request → viene de RENIEC" },
        { name: "String dni", val: '"74850912"', color: "sky" },
        { name: "String telefono", val: '"987654321"', color: "teal" },
        { name: "String email", val: '"juan@mail.com"', color: "violet" },
        { name: "CarreraEntity carrera", val: "null", color: "amber", skip: "Long ≠ CarreraEntity → tipos incompatibles" },
      ],
    },
    mappings: [
      { l: 0, r: 3, color: "sky" },
      { l: 2, r: 4, color: "teal" },
      { l: 3, r: 5, color: "violet" },
    ],
    insight: "STRICT: mismo nombre + mismo tipo = mapeo. carreraId (Long) NO se mapea a carrera (CarreraEntity). Esto es intencional y seguro.",
  },
  {
    id: "find-carrera",
    phase: "Buscar Carrera",
    title: "carreraRepository.findById(carreraId)",
    actor: "JPA → PostgreSQL (tabla carreras)",
    desc: "El Service busca la carrera en la base de datos usando el carreraId del Request. Si no existe, se lanza ResourceNotFoundException y el flujo se interrumpe.",
    code: `Optional<CarreraEntity> carreraOptional =
    carreraRepository.findById(
        estudianteRequest.getCarreraId()
    );
if (carreraOptional.isEmpty()) {
    throw new ResourceNotFoundException(
        "Carrera no encontrada"
    );
}
CarreraEntity carrera = carreraOptional.get();`,
    left: {
      label: "Parámetro de búsqueda",
      badge: "INPUT",
      badgeCls: "bg-amber-600 text-white",
      fields: [
        { name: "Long carreraId", val: "1", color: "amber" },
      ],
    },
    right: {
      label: "Resultado",
      badge: "ENTITY",
      badgeCls: "bg-emerald-600 text-white",
      fields: [
        { name: "CarreraEntity", val: '{id:1, nombre:"Ing. Software"}', color: "emerald" },
      ],
    },
    mappings: [
      { l: 0, r: 0, color: "amber" },
    ],
    error: {
      trigger: "carreraOptional.isEmpty() → carreraId no existe en la BD",
      exception: "ResourceNotFoundException",
      handler: "@ExceptionHandler(ResourceNotFoundException.class)",
      status: "404 Not Found",
      statusColor: "amber",
      code: `@ExceptionHandler(ResourceNotFoundException.class)
public ResponseEntity<ApiResponse<Void>>
    handleResourceNotFoundException(
        ResourceNotFoundException ex) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(new ApiResponse<>(
            false, ex.getMessage(), null
        ));
}`,
      response: `{
  "success": false,
  "message": "Carrera no encontrada",
  "data": null
}`,
      details: [
        "Se usa Optional para evitar NullPointerException",
        "La excepción es custom y extiende RuntimeException",
        "El handler la atrapa con @RestControllerAdvice",
        "data es null porque no hay información útil que devolver",
      ],
    },
    insight: "Este es el primer punto de fallo en el Service. Siempre se valida que la carrera exista ANTES de llamar a RENIEC (fail fast).",
  },
  {
    id: "reniec-call",
    phase: "API Externa (Feign)",
    title: "reniecClient.getData(dni, token)",
    actor: "@FeignClient → api.decolecta.com/v1/reniec/dni",
    desc: "Feign Client hace un GET a la API de RENIEC enviando el DNI y un token de autorización. Si la API falla, se captura la excepción y se lanza ExternalServiceException.",
    code: `ReniecResponse reniecResponse = null;
try {
    reniecResponse = reniecClient.getData(
        estudianteRequest.getDni(), token
    );
} catch (Exception ex) {
    throw new ExternalServiceException(ex.getMessage());
}

// ReniecClient.java (interfaz Feign):
@FeignClient(name = "reniec-client",
    url = "https://api.decolecta.com/v1/reniec/dni")
public interface ReniecClient {
    @GetMapping
    ReniecResponse getData(
        @RequestParam String numero,
        @RequestHeader("Authorization") String token
    );
}`,
    left: {
      label: "Request a RENIEC",
      badge: "FEIGN",
      badgeCls: "bg-orange-600 text-white",
      fields: [
        { name: "@RequestParam numero", val: '"74850912"', color: "sky" },
        { name: "@RequestHeader Auth", val: '"Bearer sk_102..."', color: "neutral" },
      ],
    },
    right: {
      label: "ReniecResponse",
      badge: "DTO EXTERNO",
      badgeCls: "bg-orange-600 text-white",
      fields: [
        { name: "String firstName", val: '"Juan Carlos"', color: "orange" },
        { name: "String firstLastName", val: '"Pérez"', color: "orange" },
        { name: "String secondLastName", val: '"López"', color: "orange" },
        { name: "String fullName", val: '"Juan Carlos Pérez López"', color: "neutral" },
        { name: "String documentNumber", val: '"74850912"', color: "sky" },
      ],
    },
    mappings: [
      { l: 0, r: 4, color: "sky" },
    ],
    error: {
      trigger: "La API de RENIEC no responde, timeout, 500, token inválido, DNI no encontrado...",
      exception: "ExternalServiceException",
      handler: "@ExceptionHandler(ExternalServiceException.class)",
      status: "502 Bad Gateway",
      statusColor: "orange",
      code: `@ExceptionHandler(ExternalServiceException.class)
public ResponseEntity<ApiResponse<Void>>
    handleExternalServiceException(
        ExternalServiceException ex) {
    return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
        .body(new ApiResponse<>(
            false, ex.getMessage(), null
        ));
}`,
      response: `{
  "success": false,
  "message": "[Feign] Read timed out executing GET...",
  "data": null
}`,
      details: [
        "El try-catch genérico atrapa CUALQUIER fallo de Feign",
        "502 Bad Gateway indica que el error es del servicio externo, no nuestro",
        "El mensaje original de Feign se propaga al cliente",
        "Mejora posible: crear mensajes más amigables en el handler",
      ],
    },
    insight: "Feign convierte la interfaz Java en un HTTP client real. @JsonProperty en ReniecResponse mapea snake_case (first_name) → camelCase (firstName).",
  },
  {
    id: "enrich-entity",
    phase: "Enriquecimiento manual",
    title: "RENIEC + Carrera → Entity completada",
    actor: "Setters manuales en el Service",
    desc: "El Service completa los 3 campos faltantes de la Entity: nombres de RENIEC, apellidos concatenados de RENIEC, y la carrera del findById. Luego persiste con JPA.",
    code: `// Completar campos desde RENIEC
estudiante.setNombres(reniecResponse.getFirstName());
estudiante.setApellidos(
    reniecResponse.getFirstLastName() + " "
    + reniecResponse.getSecondLastName()
);

// Asignar la relación @ManyToOne
estudiante.setCarrera(carrera);

// Persistir → genera UUID automáticamente
estudianteRepository.save(estudiante);`,
    left: {
      label: "Fuentes de datos",
      badge: "API + DB",
      badgeCls: "bg-orange-600 text-white",
      fields: [
        { name: "firstName", val: '"Juan Carlos"', color: "orange", src: "RENIEC" },
        { name: "firstLastName", val: '"Pérez"', color: "orange", src: "RENIEC" },
        { name: "secondLastName", val: '"López"', color: "orange", src: "RENIEC" },
        { name: "CarreraEntity", val: '{id:1, "Ing. Software"}', color: "amber", src: "findById" },
      ],
    },
    right: {
      label: "EstudianteEntity (persistida)",
      badge: "ENTITY",
      badgeCls: "bg-emerald-600 text-white",
      fields: [
        { name: "UUID id", val: "a1b2c3d4-e5f6-...", color: "emerald", filled: true },
        { name: "String nombres", val: '"Juan Carlos"', color: "orange", filled: true },
        { name: "String apellidos", val: '"Pérez López"', color: "orange", filled: true },
        { name: "String dni", val: '"74850912"', color: "sky" },
        { name: "String telefono", val: '"987654321"', color: "teal" },
        { name: "String email", val: '"juan@mail.com"', color: "violet" },
        { name: "CarreraEntity carrera", val: '{id:1, "Ing. Software"}', color: "amber", filled: true },
      ],
    },
    mappings: [
      { l: 0, r: 1, color: "orange", label: "setNombres()" },
      { l: 1, r: 2, color: "orange", label: "concat + set" },
      { l: 2, r: 2, color: "rose", label: "concat" },
      { l: 3, r: 6, color: "amber", label: "setCarrera()" },
    ],
    insight: "Después del save(), JPA genera el UUID y lo asigna a la Entity. Ahora la Entity tiene TODOS sus campos completos y está sincronizada con la BD.",
  },
  {
    id: "entity-to-response",
    phase: "ModelMapper + manual",
    title: "EstudianteEntity → EstudianteResponse",
    actor: "modelMapper.map(entity, response) + setter",
    desc: "ModelMapper copia 6 de 7 campos automáticamente. El campo 'carrera' requiere mapeo manual: CarreraEntity → String extrayendo solo el nombre.",
    code: `EstudianteResponse response = new EstudianteResponse();
modelMapper.map(estudiante, response);
// Auto: id, nombres, apellidos, dni, telefono, email

// Manual: CarreraEntity → String (solo el nombre)
response.setCarrera(
    estudiante.getCarrera().getNombre()
);
return response;`,
    left: {
      label: "EstudianteEntity",
      badge: "ENTITY",
      badgeCls: "bg-emerald-600 text-white",
      fields: [
        { name: "UUID id", val: "a1b2c3d4-...", color: "emerald" },
        { name: "String nombres", val: '"Juan Carlos"', color: "orange" },
        { name: "String apellidos", val: '"Pérez López"', color: "orange" },
        { name: "String dni", val: '"74850912"', color: "sky" },
        { name: "String telefono", val: '"987654321"', color: "teal" },
        { name: "String email", val: '"juan@mail.com"', color: "violet" },
        { name: "CarreraEntity carrera", val: '{id:1, nombre:"Ing.."}', color: "amber" },
      ],
    },
    right: {
      label: "EstudianteResponse",
      badge: "DTO",
      badgeCls: "bg-sky-600 text-white",
      fields: [
        { name: "UUID id", val: "a1b2c3d4-...", color: "emerald" },
        { name: "String nombres", val: '"Juan Carlos"', color: "orange" },
        { name: "String apellidos", val: '"Pérez López"', color: "orange" },
        { name: "String dni", val: '"74850912"', color: "sky" },
        { name: "String telefono", val: '"987654321"', color: "teal" },
        { name: "String email", val: '"juan@mail.com"', color: "violet" },
        { name: "String carrera", val: '"Ing. Software"', color: "amber", manual: ".getNombre()" },
      ],
    },
    mappings: [
      { l: 0, r: 0, color: "emerald" },
      { l: 1, r: 1, color: "orange" },
      { l: 2, r: 2, color: "orange" },
      { l: 3, r: 3, color: "sky" },
      { l: 4, r: 4, color: "teal" },
      { l: 5, r: 5, color: "violet" },
      { l: 6, r: 6, color: "amber", label: ".getNombre()", dashed: true },
    ],
    insight: "CarreraEntity tiene id + nombre, pero el Response solo necesita el nombre. Este es un patrón común: las Entities exponen más datos de los que el cliente debe ver.",
  },
  {
    id: "wrap-apiresponse",
    phase: "Wrapping genérico",
    title: "Response → ApiResponse<T> → 201 Created",
    actor: "new ApiResponse<>(true, msg, response)",
    desc: "El Controller envuelve el DTO en ApiResponse<T> y responde con 201 Created. La misma estructura se usa para éxitos y errores — solo cambian success, message y data.",
    code: `// Controller
return ResponseEntity.status(HttpStatus.CREATED)
    .body(new ApiResponse<>(
        true,                    // success
        "Estudiante Creado",     // message
        response                 // data
    ));

// ApiResponse.java (genérico):
@Data @AllArgsConstructor
public class ApiResponse<T> {
    private boolean success;
    private String message;
    private T data;   // EstudianteResponse, errores, null...
}`,
    left: {
      label: "EstudianteResponse",
      badge: "DTO",
      badgeCls: "bg-sky-600 text-white",
      fields: [
        { name: "UUID id", val: "a1b2c3d4-...", color: "emerald" },
        { name: "String nombres", val: '"Juan Carlos"', color: "orange" },
        { name: "String apellidos", val: '"Pérez López"', color: "orange" },
        { name: "String dni", val: '"74850912"', color: "sky" },
        { name: "String telefono", val: '"987654321"', color: "teal" },
        { name: "String email", val: '"juan@mail.com"', color: "violet" },
        { name: "String carrera", val: '"Ing. Software"', color: "amber" },
      ],
    },
    right: {
      label: "ApiResponse (201 Created)",
      badge: "RESPONSE",
      badgeCls: "bg-teal-600 text-white",
      fields: [
        { name: "boolean success", val: "true", color: "emerald" },
        { name: "String message", val: '"Estudiante Creado"', color: "emerald" },
        { name: "T data", val: "{ ...los 7 campos }", color: "teal", isWrap: true },
      ],
    },
    mappings: [{ l: -1, r: 2, color: "teal", label: "todo el objeto", wrap: true }],
    insight: "El genérico <T> es clave: para éxitos T=EstudianteResponse, para errores de validación T=Map<String,List<String>>, para otros errores T=Void (null).",
  },
];

const C = {
  sky:     { bg: "#eff6ff", border: "#bfdbfe", text: "#0369a1", line: "#38bdf8", dot: "#38bdf8", glow: "rgba(56,189,248,0.18)" },
  amber:   { bg: "#fffbeb", border: "#fde68a", text: "#92400e", line: "#fbbf24", dot: "#fbbf24", glow: "rgba(251,191,36,0.18)" },
  teal:    { bg: "#f0fdfa", border: "#99f6e4", text: "#115e59", line: "#2dd4bf", dot: "#2dd4bf", glow: "rgba(45,212,191,0.18)" },
  violet:  { bg: "#f5f3ff", border: "#c4b5fd", text: "#5b21b6", line: "#a78bfa", dot: "#a78bfa", glow: "rgba(167,139,250,0.18)" },
  orange:  { bg: "#fff7ed", border: "#fed7aa", text: "#9a3412", line: "#fb923c", dot: "#fb923c", glow: "rgba(251,146,60,0.18)" },
  emerald: { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46", line: "#34d399", dot: "#34d399", glow: "rgba(52,211,153,0.18)" },
  rose:    { bg: "#fff1f2", border: "#fecdd3", text: "#9f1239", line: "#fb7185", dot: "#fb7185", glow: "rgba(251,113,133,0.18)" },
  neutral: { bg: "#f5f5f5", border: "#e5e5e5", text: "#737373", line: "#a3a3a3", dot: "#a3a3a3", glow: "rgba(163,163,163,0.12)" },
};

function FieldBox({ f, idx, side, hoveredPair, onHover, onLeave, stepMappings }) {
  const c = C[f.color] || C.neutral;
  const anyHover = hoveredPair !== null;
  const isInvolved = anyHover && stepMappings.some(
    m => `${m.l}-${m.r}` === hoveredPair && ((side === "l" && m.l === idx) || (side === "r" && m.r === idx))
  );
  const pairKey = stepMappings.find(m => (side === "l" && m.l === idx) || (side === "r" && m.r === idx));

  return (
    <div
      data-field={`${side}-${idx}`}
      onMouseEnter={() => pairKey && onHover(`${pairKey.l}-${pairKey.r}`)}
      onMouseLeave={onLeave}
      style={{
        background: isInvolved ? c.glow : (f.skip ? "transparent" : c.bg),
        borderColor: isInvolved ? c.line : (f.skip ? "#e5e7eb" : c.border),
        boxShadow: isInvolved ? `0 0 0 2px ${c.glow}` : "none",
        opacity: anyHover && !isInvolved ? 0.35 : 1,
        borderStyle: f.skip ? "dashed" : "solid",
      }}
      className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg border transition-all duration-200 cursor-default"
    >
      <div style={{ background: c.dot }} className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {f.src && (
            <span className="text-[8px] font-bold uppercase tracking-wider px-1 rounded" style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>{f.src}</span>
          )}
          <code className="text-[11px] font-semibold" style={{ color: c.text }}>{f.name}</code>
          {f.ann && <span className="text-[9px] px-1 rounded bg-violet-50 text-violet-500 font-medium border border-violet-100">{f.ann}</span>}
          {f.manual && <span className="text-[9px] px-1 rounded bg-amber-50 text-amber-600 font-bold border border-amber-200">manual: {f.manual}</span>}
          {f.filled && <span className="text-[9px] px-1 rounded bg-emerald-50 text-emerald-600 font-bold border border-emerald-200">completado</span>}
        </div>
        <div className="text-[10px] mt-0.5 font-mono text-neutral-500 truncate">{f.val}</div>
        {f.skip && (
          <div className="flex items-center gap-1 mt-0.5">
            <svg width="10" height="10" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="none" stroke="#ef4444" strokeWidth="1.5" /><line x1="5" y1="5" x2="11" y2="11" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" /></svg>
            <span className="text-[9px] text-red-500 font-medium">{f.skip}</span>
          </div>
        )}
        {f.isWrap && (
          <div className="flex items-center gap-1 mt-0.5">
            <svg width="10" height="10" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" rx="3" fill="none" stroke="#14b8a6" strokeWidth="1.5" /><rect x="5" y="5" width="6" height="6" rx="1.5" fill="#14b8a6" opacity="0.3" /></svg>
            <span className="text-[9px] text-teal-600 font-medium">Contiene el DTO completo</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectorSVG({ step, hoveredPair, containerRef }) {
  const [lines, setLines] = useState([]);
  const compute = useCallback(() => {
    if (!containerRef.current) return;
    const box = containerRef.current.getBoundingClientRect();
    const nl = [];
    step.mappings.forEach((m) => {
      if (m.wrap) {
        const allL = containerRef.current.querySelectorAll('[data-field^="l-"]');
        const rEl = containerRef.current.querySelector(`[data-field="r-${m.r}"]`);
        if (allL.length && rEl) {
          const f = allL[0].getBoundingClientRect(), la = allL[allL.length - 1].getBoundingClientRect(), r = rEl.getBoundingClientRect();
          nl.push({ key: `w-${m.r}`, x1: f.right - box.left, y1a: f.top + f.height / 2 - box.top, y1b: la.top + la.height / 2 - box.top, x2: r.left - box.left, y2: r.top + r.height / 2 - box.top, color: C[m.color]?.line || "#a3a3a3", label: m.label, pairKey: `${m.l}-${m.r}`, isWrap: true });
        }
        return;
      }
      const lEl = containerRef.current.querySelector(`[data-field="l-${m.l}"]`);
      const rEl = containerRef.current.querySelector(`[data-field="r-${m.r}"]`);
      if (lEl && rEl) {
        const l = lEl.getBoundingClientRect(), r = rEl.getBoundingClientRect();
        nl.push({ key: `${m.l}-${m.r}`, x1: l.right - box.left, y1: l.top + l.height / 2 - box.top, x2: r.left - box.left, y2: r.top + r.height / 2 - box.top, color: C[m.color]?.line || "#a3a3a3", label: m.label, pairKey: `${m.l}-${m.r}`, dashed: m.dashed });
      }
    });
    setLines(nl);
  }, [step, containerRef]);

  useEffect(() => {
    compute();
    const t = setTimeout(compute, 120);
    window.addEventListener("resize", compute);
    return () => { clearTimeout(t); window.removeEventListener("resize", compute); };
  }, [compute]);

  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%", overflow: "visible" }}>
      {lines.map((ln) => {
        const active = hoveredPair === ln.pairKey;
        const any = hoveredPair !== null;
        const op = any ? (active ? 1 : 0.08) : 0.5;
        const sw = active ? 2.5 : 1.5;
        const mx = (ln.x1 + ln.x2) / 2;
        if (ln.isWrap) {
          return (
            <g key={ln.key} opacity={op}>
              <path d={`M${ln.x1},${ln.y1a} C${mx},${ln.y1a} ${mx},${ln.y2} ${ln.x2},${ln.y2}`} fill="none" stroke={ln.color} strokeWidth={sw} strokeDasharray="5 3" />
              <path d={`M${ln.x1},${ln.y1b} C${mx},${ln.y1b} ${mx},${ln.y2} ${ln.x2},${ln.y2}`} fill="none" stroke={ln.color} strokeWidth={sw} strokeDasharray="5 3" />
              {ln.label && <text x={mx} y={ln.y2 - 8} textAnchor="middle" fontSize="8" fontWeight="600" fill={ln.color}>{ln.label}</text>}
            </g>
          );
        }
        return (
          <g key={ln.key} opacity={op}>
            <path d={`M${ln.x1},${ln.y1} C${mx},${ln.y1} ${mx},${ln.y2} ${ln.x2},${ln.y2}`} fill="none" stroke={ln.color} strokeWidth={sw} strokeDasharray={ln.dashed ? "5 3" : "none"} />
            <circle cx={ln.x2} cy={ln.y2} r={active ? 4 : 3} fill={ln.color} />
            {ln.label && active && (
              <>
                <rect x={mx - 36} y={(ln.y1 + ln.y2) / 2 - 10} width="72" height="16" rx="4" fill="white" stroke={ln.color} strokeWidth="0.5" />
                <text x={mx} y={(ln.y1 + ln.y2) / 2 + 1} textAnchor="middle" fontSize="8" fontWeight="600" fill={ln.color}>{ln.label}</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function ErrorPanel({ error }) {
  const [open, setOpen] = useState(false);
  const sc = C[error.statusColor] || C.rose;
  return (
    <div className="rounded-xl border-2 border-dashed overflow-hidden" style={{ borderColor: sc.line + "66" }}>
      <button onClick={() => setOpen(!open)} className="w-full text-left px-4 py-3 flex items-center gap-3" style={{ background: sc.glow }}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <svg width="18" height="18" viewBox="0 0 20 20" className="flex-shrink-0">
            <path d="M10 2L18 17H2L10 2Z" fill="none" stroke={sc.line} strokeWidth="1.5" strokeLinejoin="round" />
            <line x1="10" y1="8" x2="10" y2="12" stroke={sc.line} strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="10" cy="14.5" r="0.8" fill={sc.line} />
          </svg>
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: sc.text }}>Camino de error</div>
            <div className="text-xs font-semibold" style={{ color: sc.text }}>{error.exception} → {error.status}</div>
          </div>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} style={{ color: sc.text }}>
          <path d="M3 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="px-4 py-3 space-y-3 bg-white">
          <div className="px-3 py-2 rounded-lg border border-neutral-100" style={{ background: sc.bg }}>
            <div className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: sc.text }}>Trigger</div>
            <p className="text-xs" style={{ color: sc.text }}>{error.trigger}</p>
          </div>

          <div className="space-y-1.5">
            <div className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">Flujo en el GlobalExceptionHandler</div>
            {error.details.map((d, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-neutral-600">
                <span className="w-4 h-4 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                {d}
              </div>
            ))}
          </div>

          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-1">Handler</div>
            <pre className="text-[10px] leading-relaxed bg-neutral-900 text-neutral-200 p-3 rounded-lg overflow-x-auto"><code>{error.code}</code></pre>
          </div>

          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-1">JSON de respuesta al cliente</div>
            <pre className="text-[10px] leading-relaxed p-3 rounded-lg overflow-x-auto border" style={{ background: sc.bg, borderColor: sc.border, color: sc.text }}><code>{error.response}</code></pre>
          </div>
        </div>
      )}
    </div>
  );
}

function StepView({ step, index, isOpen, toggle }) {
  const [hovered, setHovered] = useState(null);
  const [showCode, setShowCode] = useState(false);
  const ref = useRef(null);

  return (
    <div className="relative">
      {index > 0 && (
        <div className="flex justify-center -mt-1 mb-1">
          <svg width="20" height="28" viewBox="0 0 20 28"><line x1="10" y1="0" x2="10" y2="22" stroke="#d4d4d4" strokeWidth="1.5" /><polygon points="6,20 10,27 14,20" fill="#d4d4d4" /></svg>
        </div>
      )}
      <div className={`rounded-2xl border overflow-hidden transition-all duration-300 ${isOpen ? "border-sky-200 shadow-lg shadow-sky-50 bg-white" : "bg-white border-neutral-200 hover:border-neutral-300 hover:shadow-md"}`}>
        <button onClick={toggle} className="w-full text-left px-4 py-3 flex items-center gap-3 group">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${isOpen ? "bg-sky-600 text-white" : "bg-neutral-100 text-neutral-400 group-hover:bg-sky-50 group-hover:text-sky-600"}`}>
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-neutral-400">{step.phase}</span>
              {step.error && (
                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 rounded" style={{ background: C[step.error.statusColor]?.glow, color: C[step.error.statusColor]?.text, border: `1px solid ${C[step.error.statusColor]?.border}` }}>
                  puede fallar
                </span>
              )}
            </div>
            <div className="text-sm font-semibold text-neutral-800 truncate">{step.title}</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={`text-neutral-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? "rotate-180" : ""}`}>
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {isOpen && (
          <div className="px-4 pb-4 space-y-3">
            <div className="flex items-center gap-2">
              <code className="text-[10px] text-neutral-500 bg-neutral-50 px-2 py-1 rounded border border-neutral-100 flex-1 truncate">{step.actor}</code>
              <button onClick={() => setShowCode(!showCode)} className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors flex-shrink-0 ${showCode ? "bg-neutral-800 text-white border-neutral-800" : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400"}`}>
                {showCode ? "Ocultar" : "Ver"} Java
              </button>
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed">{step.desc}</p>
            {showCode && (
              <pre className="text-[10px] leading-relaxed bg-neutral-900 text-neutral-200 p-3 rounded-xl overflow-x-auto border border-neutral-700"><code>{step.code}</code></pre>
            )}
            <div ref={ref} className="relative flex gap-2 items-start">
              <div className="flex-1 min-w-0 space-y-1.5 z-10">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${step.left.badgeCls}`}>{step.left.badge}</span>
                  <span className="text-[11px] font-semibold text-neutral-600 truncate">{step.left.label}</span>
                </div>
                {step.left.fields.map((f, i) => (
                  <FieldBox key={i} f={f} idx={i} side="l" hoveredPair={hovered} onHover={setHovered} onLeave={() => setHovered(null)} stepMappings={step.mappings} />
                ))}
              </div>
              <div className="w-16 flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5 z-10">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${step.right.badgeCls}`}>{step.right.badge}</span>
                  <span className="text-[11px] font-semibold text-neutral-600 truncate">{step.right.label}</span>
                </div>
                {step.right.fields.map((f, i) => (
                  <FieldBox key={i} f={f} idx={i} side="r" hoveredPair={hovered} onHover={setHovered} onLeave={() => setHovered(null)} stepMappings={step.mappings} />
                ))}
              </div>
              <ConnectorSVG step={step} hoveredPair={hovered} containerRef={ref} />
            </div>
            {step.error && <ErrorPanel error={step.error} />}
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-sky-50 border border-sky-100">
              <svg width="14" height="14" viewBox="0 0 16 16" className="flex-shrink-0 mt-0.5"><circle cx="8" cy="8" r="7" fill="none" stroke="#0284c7" strokeWidth="1.5" /><circle cx="8" cy="5" r="1" fill="#0284c7" /><line x1="8" y1="7.5" x2="8" y2="12" stroke="#0284c7" strokeWidth="1.5" strokeLinecap="round" /></svg>
              <p className="text-[11px] text-sky-700 leading-relaxed">{step.insight}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DTOMappingV3() {
  const [openIdx, setOpenIdx] = useState(0);
  const [allOpen, setAllOpen] = useState(false);

  return (
    <div className="max-w-2xl mx-auto py-6 px-3">
      <div className="mb-6">
        <div className="text-[9px] font-bold uppercase tracking-widest text-sky-500 mb-1">Proyecto spring-repaso · CodiGo by Tecsup</div>
        <h1 className="text-lg font-bold text-neutral-900 mb-1">
          ¿Qué pasa cuando guardas un estudiante? El recorrido completo del dato
        </h1>
        <p className="text-xs text-neutral-400">Desde el JSON que envía el cliente hasta la respuesta de la API — incluyendo validaciones, consulta a RENIEC y qué ocurre cuando algo falla</p>
        <div className="mt-3 px-3 py-2.5 rounded-lg bg-neutral-50 border border-neutral-200 space-y-1">
          <p className="text-[11px] text-neutral-600 leading-relaxed">
            <span className="font-semibold text-neutral-700">¿Cómo seguir este flujo?</span> Cada paso se abre con un click y muestra dos paneles: a la izquierda los datos de origen y a la derecha el resultado de la transformación. Las líneas de colores conectan cada campo con su destino — pasá el mouse sobre cualquier campo para resaltar su par. Los pasos marcados con <span className="text-[9px] font-semibold px-1 rounded bg-rose-50 text-rose-500 border border-rose-200">puede fallar</span> tienen un panel de error desplegable que muestra qué sale mal y qué respuesta recibe el cliente. Usá el botón <span className="font-semibold">"Ver Java"</span> en cada paso para ver el código real del proyecto.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { label: "Automático", cls: "bg-sky-50 text-sky-600 border-sky-200" },
            { label: "Manual", cls: "bg-amber-50 text-amber-600 border-amber-200" },
            { label: "No mapeado", cls: "bg-red-50 text-red-500 border-red-200" },
            { label: "Puede fallar", cls: "bg-rose-50 text-rose-500 border-rose-200" },
          ].map((l, i) => (
            <span key={i} className={`text-[9px] font-semibold px-2 py-0.5 rounded border ${l.cls}`}>{l.label}</span>
          ))}
        </div>
        <button onClick={() => { setAllOpen(!allOpen); if (!allOpen) setOpenIdx(-1); }} className="text-[10px] font-semibold text-neutral-400 hover:text-sky-600 px-2 py-1 rounded border border-neutral-200 hover:border-sky-200 transition-colors">
          {allOpen ? "Colapsar" : "Expandir"} todo
        </button>
      </div>

      <div className="space-y-5">
        {STEPS.map((s, i) => (
          <StepView key={s.id} step={s} index={i} isOpen={allOpen || openIdx === i} toggle={() => { if (allOpen) return; setOpenIdx(openIdx === i ? -1 : i); }} />
        ))}
      </div>

      <div className="mt-6 p-4 rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50">
        <div className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 mb-3">Resumen de excepciones — @RestControllerAdvice</div>
        <div className="space-y-2">
          {[
            { exc: "MethodArgumentNotValidException", status: "400", where: "Paso 2 — @Valid", color: "rose", data: "Map<String, List<String>>", desc: "El cliente envió datos mal formados: un DNI con letras, un email sin @, campos vacíos, etc. Estas validaciones se definen en el DTO con anotaciones como @NotBlank, @Pattern, @Email y @NotNull. Spring las revisa automáticamente y ni siquiera deja pasar el request al Controller." },
            { exc: "ResourceNotFoundException", status: "404", where: "Paso 4 — findById", color: "amber", data: "null", desc: "Se buscó algo que no existe en la base de datos. Aquí se usa cuando el alumno manda un carreraId que no corresponde a ninguna carrera registrada." },
            { exc: "ExternalServiceException", status: "502", where: "Paso 5 — Feign Client", color: "orange", data: "null", desc: "La API de RENIEC no respondió. Puede ser porque se cayó, tardó demasiado, el token venció o el DNI no se encontró. El error no es nuestro, es del servicio externo." },
          ].map((e, i) => {
            const c = C[e.color];
            return (
              <div key={i} className="px-3 py-2.5 rounded-lg border bg-white" style={{ borderColor: c.border }}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold px-2 py-0.5 rounded flex-shrink-0" style={{ background: c.bg, color: c.text }}>{e.status}</span>
                  <div className="flex-1 min-w-0">
                    <code className="text-[11px] font-semibold" style={{ color: c.text }}>{e.exc}</code>
                    <div className="text-[10px] text-neutral-400">{e.where} · data: {e.data}</div>
                  </div>
                </div>
                <p className="text-[10px] text-neutral-500 leading-relaxed mt-1.5 pl-11">{e.desc}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-3 px-3 py-2 rounded-lg bg-sky-50 border border-sky-100">
          <p className="text-[11px] text-sky-700 leading-relaxed">
            Todas pasan por <code className="font-semibold">GlobalExceptionHandler</code> con <code className="font-semibold">@RestControllerAdvice</code>. 
            Las 3 respuestas usan la misma estructura <code className="font-semibold">ApiResponse&lt;T&gt;</code> con <code>success: false</code>. 
            Esto garantiza un contrato consistente para el frontend.
          </p>
        </div>
      </div>
      <img src="https://hits.sh/cbeltran-dev.github.io/spring-estudiantes.svg"></img>
    </div>
  );
}