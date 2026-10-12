// Actualiza el formulario de clases al aire libre: pregunta por entrenamiento híbrido, frecuencia semanal,
// problemas cardiorrespiratorios y patologías/lesiones, y obliga a poner un celular y un mail válidos.
// Se ejecuta UNA vez desde el editor de Apps Script (necesita el permiso de Formularios).
function actualizarFormularioClases() {
  var f = FormApp.openById("15EamGh-Sm8ar72zJRq1TwNQNdjB1UOkv7i50SM_Xx9I");
  var items = f.getItems();
  var buscar = function (titulo) { return f.getItems().filter(function (i) { return i.getTitle() === titulo; })[0]; };

  // posición donde van las preguntas nuevas: donde estaba la de experiencia
  var tituloViejo = "¿Cuál es tu experiencia entrenando?";
  var viejo = buscar(tituloViejo);
  if (!viejo) throw new Error("No se encontró la pregunta de experiencia; ¿ya se actualizó el formulario?");
  var pos = viejo.getIndex();

  // se sacan las preguntas que ahora quedan cubiertas por las nuevas
  ["¿Cuál es tu experiencia entrenando?", "Lesiones actuales o anteriores, cirugías", "¿Tenés alguna de estas condiciones?"].forEach(function (t) {
    var it = buscar(t); if (it) f.deleteItem(it);
  });

  var nuevos = [];
  nuevos.push(f.addMultipleChoiceItem().setTitle("¿Conocés el entrenamiento híbrido?")
    .setHelpText("Combina fuerza y resistencia en un mismo plan.")
    .setChoiceValues(["Sí, ya lo practico", "Sí, lo conozco pero no lo practico", "No lo conozco"]).setRequired(true));
  nuevos.push(f.addMultipleChoiceItem().setTitle("¿Cuántas veces por semana entrenás actualmente?")
    .setChoiceValues(["Menos de 3 veces", "De 3 a 5 veces", "Más de 5 veces"]).setRequired(true));
  nuevos.push(f.addMultipleChoiceItem().setTitle("¿Sufriste problemas cardiorrespiratorios?")
    .setHelpText("Por ejemplo: problemas del corazón, presión alta, arritmias, asma o dificultades para respirar.")
    .setChoiceValues(["No", "Sí"]).setRequired(true));
  nuevos.push(f.addParagraphTextItem().setTitle("Si respondiste que sí, contanos cuáles y si estás bajo tratamiento").setRequired(false));
  nuevos.push(f.addMultipleChoiceItem().setTitle("¿Tenés patologías o lesiones?")
    .setHelpText("Actuales o anteriores, incluyendo cirugías.")
    .setChoiceValues(["No", "Sí"]).setRequired(true));
  nuevos.push(f.addParagraphTextItem().setTitle("Si respondiste que sí, contanos cuáles").setRequired(false));
  nuevos.forEach(function (it, k) { f.moveItem(it.getIndex(), pos + k); });

  // celular y mail obligatorios y con formato válido
  var wa = buscar("WhatsApp");
  if (wa) {
    wa.asTextItem().setRequired(true).setHelpText("Obligatorio. Con código de área, solo números. Ej: 11 5555-1234")
      .setValidation(FormApp.createTextValidation().setHelpText("Escribí un número de celular válido (8 a 15 dígitos).").requireTextMatchesPattern("^[0-9 +()\-]{8,20}$").build());
  }
  var mail = buscar("Mail");
  if (mail) {
    mail.asTextItem().setRequired(true).setHelpText("Obligatorio. Ej: nombre@gmail.com")
      .setValidation(FormApp.createTextValidation().setHelpText("Escribí un mail válido.").requireTextIsEmail().build());
  }
  Logger.log("Formulario actualizado. Preguntas: " + f.getItems().length);
  Logger.log("LINK PARA COMPARTIR: " + f.getPublishedUrl());
}
