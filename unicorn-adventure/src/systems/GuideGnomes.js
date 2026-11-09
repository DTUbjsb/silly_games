import { UNICORN_CATEGORIES } from '../data/unicornCategories.js';
import { wizardTeam } from './WizardTeam.js';

export function guideLines(id, { unicorns, accessories, tools, southOpen, dragonRescued, princess }) {
  const count = (id) => unicorns.filter(UNICORN_CATEGORIES.find((category) => category.id === id).matches).length;
  const tool = (kind) => tools.filter((item) => item.kind === kind).length;
  const saddles = accessories.filter((item) => item.slot === 'saddle').length;
  const wings = accessories.filter((item) => item.slot === 'wings').length;
  const ending = 'Hurra! Prinsen er fri, og dragen er besejret. Besøg den glade dronning ved stalden!';
  const guides = {
    'guide-speed': [
      'Med to hvide eller regnbueenhjørninger og to sadler kan I få fartboost på kortet: Tryk MELLEMRUM, når I ikke står ved noget, I kan undersøge.',
      'Boostet giver 50 % mere fart i 2 sekunder. To mørke enhjørninger giver 50 % mere fart i 4 sekunder, og to vulkanenhjørninger giver 100 % mere fart i 4 sekunder. Alle kræver to sadler.',
      'Der går 10 sekunder fra et boost starter, til I kan bruge det igen. Tiden går kun, mens I udforsker kortet.',
      'Jeg prøvede at løbe om kap med en snegl. Den vandt, for jeg faldt i søvn undervejs. Høhø!',
    ],
    'guide-west': [
      dragonRescued ? ending : unicorns.length < 2 || saddles < 2 || wings < 2
        ? 'Find to enhjørninger, to sadler og to sæt vinger. Så kan I prøve at flyve over lavarevnen mod vest til regnbueenhjørningerne.'
        : 'I har det, der skal til! Gå til lavarevnen mod vest, svar på spørgsmålet og flyv til regnbueenhjørningerne.',
      'Min hat blæste væk i går. Nu har jeg endelig noget at tænke over, høhø!',
    ],
    'guide-lake': [
      dragonRescued ? ending : tool('flashlight') === 0
        ? 'Sejl med båden på søens sydlige bred til øen og find lommelygten. Den skal I bruge til hulen i nord og de mørke enhjørninger.'
        : count('dark') === 0
          ? 'I har lommelygten! Find hullet i den nordlige mur, kryds hulen og led efter en mørk enhjørning.'
          : 'I fandt en mørk enhjørning! Saml også en regnbue- og en vulkanenhjørning til kampen mod troldmanden i syd.',
      'Jeg spurgte en fisk om vej. Den svarede bare: Blub. Det var ikke særlig hjælpsomt, høhø!',
    ],
    'guide-rainbow': [
      dragonRescued ? ending : tool('lava-boots') < 2
        ? 'Find de to par lavastøvler syd for troldens bro her i regnbueområdet. Med dem kan I krydse lavakløften i øst til vulkanen.'
        : count('volcano') === 0
          ? 'I har begge par lavastøvler! Find lavakløften i øst og kryds den for at lede efter en vulkanenhjørning.'
          : 'I fandt en vulkanenhjørning! Husk også en af hver af de andre slags til troldmanden mod syd.',
      'Jeg købte usynlige støvler i går. Jeg kan bare ikke finde dem igen, høhø!',
    ],
    'guide-north': [
      dragonRescued ? ending : tool('flashlight') === 0
        ? 'Hulen i den nordlige mur er mørk. Tag båden ved søen mod øst til øen og find lommelygten først.'
        : count('dark') === 0
          ? 'Brug lommelygten og kryds hulen i nord. Find en mørk enhjørning til holdet mod troldmanden.'
          : 'I har en mørk enhjørning. Husk også en hvid, en regnbue- og en vulkanenhjørning til troldmanden i syd.',
      'Jeg ledte efter min lommelygte hele natten. Da det blev lyst, fandt jeg den straks, høhø!',
    ],
    'guide-east': [
      dragonRescued ? ending : tool('lava-boots') < 2
        ? 'For at krydse lavakløften mod øst skal I finde to par lavastøvler syd for troldens bro i regnbueområdet mod vest.'
        : count('volcano') === 0
          ? 'I har begge par lavastøvler. Kryds lavakløften mod øst og find en vulkanenhjørning.'
          : 'I har en vulkanenhjørning! Saml en af hver slags og tilbehør til troldmanden i syd.',
      'Jeg ristede en skumfidus over lavaen. Nu leder jeg efter pinden, høhø!',
    ],
    'guide-dark': [
      dragonRescued ? ending : count('dark') === 0
        ? 'Led efter en mørk enhjørning her i nord. I skal bruge en enhjørning af hver slags mod troldmanden i syd.'
        : 'I har en mørk enhjørning! To mørke enhjørninger og to sadler giver et fartboost på 50 % i 4 sekunder med MELLEMRUM på kortet.',
      'Jeg ville fortælle et spøgelse en hemmelighed, men det så lige igennem mig, høhø!',
    ],
    'guide-volcano': [
      dragonRescued ? ending : count('volcano') === 0
        ? 'Led efter en vulkanenhjørning her. Den skal med sammen med en hvid, en regnbue- og en mørk enhjørning mod troldmanden.'
        : 'To vulkanenhjørninger og to sadler giver dobbelt fart i 4 sekunder med MELLEMRUM på kortet. Husk også de andre enhjørninger og tilbehøret til troldmanden i syd.',
      'Min vulkan-kage blev lidt brændt. Til gengæld pustede den selv lysene ud, høhø!',
    ],
    'guide-wizard': [
      dragonRescued ? ending : southOpen
        ? princess ? (tool('bow-and-arrow') < 2
          ? 'Vejen mod syd er åben, og prinsessen er med jer. Find begge buer med pile og gå til dragens hule.'
          : 'Vejen mod syd er åben, og I har både prinsessen og buerne. Gå til dragens hule!')
          : 'Vejen mod syd er åben! Find krigerprinsessen, og vind hendes træningskamp, så hun følger med jer.'
        : wizardTeam(unicorns, accessories)
          ? 'I har holdet klar! Udfordr troldmanden ved muren mod syd for at åbne vejen til prinsessen.'
          : 'Troldmanden i syd kræver en hvid, en regnbue-, en mørk og en vulkanenhjørning samt fire mærker, fire sæt vinger, fire hatte og fire sadler.',
      'Troldmanden tryllede min frokost væk. Heldigvis havde jeg allerede spist den, høhø!',
    ],
    'guide-dragon': [
      dragonRescued ? ending : !princess
        ? 'Find krigerprinsessen i det sydlige område. Svar på hendes spørgsmål og vind træningskampen, så hun følger med jer.'
        : tool('bow-and-arrow') < 2
          ? 'Krigerprinsessen er med jer! Find begge buer med pile i det sydlige område, før I går til dragens hule.'
          : 'I er klar til dragens hule! Svar på fire spørgsmål. Sigt med musen og skyd med MELLEMRUM; styr prinsessen med pilene, så hun undviger ildkugler og rammer dragen.',
      'Jeg gav en drage et fødselsdagslys. Den pustede på det, og så havde vi ti lys mere, høhø!',
    ],
  };
  if (!guides[id]) throw new Error(`Ukendt vejvisernisse: "${id}".`);
  return guides[id];
}
