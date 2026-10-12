// Crea en Google Forms el formulario de inscripción a las clases al aire libre de los domingos.
// Se ejecuta UNA vez desde el editor de Apps Script (necesita el permiso de Formularios) y deja en el
// registro (Ver > Registro) el link para compartir y el link para editarlo. Las respuestas van a una hoja nueva.
// Los textos legales son un BORRADOR: que los revise un abogado antes de publicar.
function crearFormularioClases() {
  var f = FormApp.create("Clases al aire libre - Domingos | Elite Preparation");
  f.setDescription(
    "Completá este formulario para anotarte a las clases de entrenamiento al aire libre de los domingos.\n" +
    "Tus datos de salud se usan solo para cuidarte durante la clase y no se comparten con terceros.\n" +
    "Los campos con * son obligatorios.");
  f.setCollectEmail(false);
  f.setConfirmationMessage("¡Listo! Recibimos tu inscripción. Te escribimos por WhatsApp para confirmarte el lugar, el horario y los detalles de pago. ¡Gracias por sumarte!");

  var texto = function (t, req, ayuda) { var i = f.addTextItem().setTitle(t).setRequired(req); if (ayuda) i.setHelpText(ayuda); return i; };
  var parrafo = function (t, req, ayuda) { var i = f.addParagraphTextItem().setTitle(t).setRequired(req); if (ayuda) i.setHelpText(ayuda); return i; };
  var opciones = function (t, lista, req) { return f.addMultipleChoiceItem().setTitle(t).setChoiceValues(lista).setRequired(req); };
  var tilde = function (t, req) { var i = f.addCheckboxItem().setTitle(t).setChoiceValues(["Sí, acepto"]).setRequired(req); return i; };

  f.addSectionHeaderItem().setTitle("1. Tus datos");
  texto("Nombre y apellido", true);
  texto("DNI", true);
  f.addDateItem().setTitle("Fecha de nacimiento").setRequired(true);
  texto("WhatsApp", true, "Con código de área. Ej: 11 5555-1234");
  texto("Mail", true);
  texto("Instagram", false, "Opcional. Ej: @usuario");
  texto("Localidad donde vivís", false);

  f.addPageBreakItem().setTitle("2. Emergencia y cobertura de salud");
  texto("Contacto de emergencia: nombre y parentesco", true);
  texto("Contacto de emergencia: teléfono", true);
  texto("Obra social o prepaga y número de afiliado", true, "Si no tenés, escribí 'No tengo'.");

  f.addPageBreakItem().setTitle("3. Tu salud y tu experiencia");
  opciones("¿Cuál es tu experiencia entrenando?", ["Nunca entrené", "Entreno hace menos de 6 meses", "Entreno hace más de 6 meses", "Entreno de forma regular"], true);
  parrafo("Lesiones actuales o anteriores, cirugías", true, "Si no tuviste, escribí 'Ninguna'.");
  f.addCheckboxItem().setTitle("¿Tenés alguna de estas condiciones?")
    .setChoiceValues(["Ninguna", "Problemas cardíacos", "Presión alta", "Asma o problemas respiratorios", "Diabetes", "Embarazo", "Otra (la aclaro abajo)"])
    .setRequired(true);
  parrafo("Aclaraciones de salud o medicación que tomes", false, "Opcional. Escribí si tomás medicación o tenés otra condición.");
  opciones("¿Tenés apto físico vigente?", ["Sí, tengo y lo puedo presentar", "No tengo, pero lo voy a presentar", "No tengo"], true);
  opciones("¿Algún médico te dijo que tenés un problema cardíaco o que solo hagas actividad física bajo supervisión médica?", ["No", "Sí"], true);
  opciones("¿Sentís dolor en el pecho cuando hacés actividad física o en reposo?", ["No", "Sí"], true);
  opciones("¿Perdiste el equilibrio por mareos o perdiste el conocimiento alguna vez?", ["No", "Sí"], true);
  opciones("¿Tenés algún problema óseo o articular que pueda empeorar con la actividad física?", ["No", "Sí"], true);

  f.addPageBreakItem().setTitle("4. La clase");
  texto("¿Qué domingo o domingos querés venir?", true, "Escribí la fecha o fechas.");
  opciones("¿Es tu primera vez en una clase nuestra?", ["Sí", "No"], true);
  texto("¿Cómo nos conociste?", false);

  f.addPageBreakItem().setTitle("5. Autorizaciones").setHelpText("Leé con atención y marcá cada una.");
  tilde("Declaro que los datos que completé son verdaderos y que me encuentro en condiciones físicas de realizar actividad física. Me comprometo a avisar de inmediato si me siento mal durante la clase.", true);
  tilde("Conozco los riesgos propios de la actividad física al aire libre y participo bajo mi responsabilidad, respetando las indicaciones del profesor.", true);
  tilde("Autorizo el tratamiento de mis datos personales, incluidos los datos de salud, para organizar la clase y contactarme, conforme a la Ley 25.326. Puedo pedir acceso, corrección o eliminación de mis datos escribiendo al coach.", true);
  tilde("Autorizo el uso de fotos y videos de las clases en los que pueda aparecer, para difusión en las redes de Elite Preparation. (Opcional)", false);
  texto("Si sos menor de 18 años: nombre, DNI y teléfono de la madre, padre o tutor que te autoriza", false, "Solo para menores de edad.");

  var hoja = SpreadsheetApp.create("Respuestas - Clases al aire libre (domingos)");
  f.setDestination(FormApp.DestinationType.SPREADSHEET, hoja.getId());

  Logger.log("LINK PARA COMPARTIR: " + f.getPublishedUrl());
  Logger.log("LINK PARA EDITAR: " + f.getEditUrl());
  Logger.log("HOJA DE RESPUESTAS: " + hoja.getUrl());
}
