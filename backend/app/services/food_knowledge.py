"""Built-in "famous food by place" guide used when the AI model is not available."""

import re
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Dish:
    name: str
    blurb: str
    veg: bool


@dataclass(frozen=True)
class Place:
    name: str
    intro: str
    dishes: tuple[Dish, ...]
    aliases: tuple[str, ...] = ()
    menu_keywords: tuple[str, ...] = field(default=())


PLACES: tuple[Place, ...] = (
    Place(
        "Hyderabad",
        "Hyderabad is famous for rich Nizami and Deccani cooking.",
        (
            Dish("Hyderabadi Biryani", "dum-cooked basmati and marinated meat, sealed and slow-cooked", False),
            Dish("Haleem", "wheat, lentils and meat pounded into a slow-cooked stew — a Ramzan favourite", False),
            Dish("Mirchi ka Salan", "chillies in a tangy peanut-sesame gravy, served with biryani", True),
            Dish("Double ka Meetha", "fried bread soaked in saffron milk", True),
            Dish("Irani Chai & Osmania Biscuits", "the city's classic café pairing", True),
        ),
        aliases=("telangana", "secunderabad"),
    ),
    Place(
        "Mumbai",
        "Mumbai is famous for fast, flavour-packed street food.",
        (
            Dish("Vada Pav", "spiced potato fritter in a soft bun with chutneys", True),
            Dish("Pav Bhaji", "buttery mashed vegetable curry with toasted pav", True),
            Dish("Bhel Puri", "puffed rice tossed with chutneys — a Chowpatty beach classic", True),
            Dish("Misal Pav", "spicy sprouted-moth curry topped with farsan", True),
            Dish("Bombil Fry", "crisp fried Bombay duck fish", False),
        ),
        aliases=("bombay", "maharashtra"),
    ),
    Place(
        "Delhi",
        "Delhi is famous for Mughlai and Punjabi food and its chaat.",
        (
            Dish("Chole Bhature", "spicy chickpea curry with puffed fried bread", True),
            Dish("Butter Chicken", "tandoori chicken in a creamy tomato-butter gravy", False),
            Dish("Dal Makhani", "black lentils slow-cooked with butter and cream", True),
            Dish("Paranthe", "stuffed flatbreads — try Paranthe Wali Gali in Chandni Chowk", True),
            Dish("Aloo Tikki Chaat", "crisp potato patties with yoghurt and chutneys", True),
            Dish("Nihari", "slow-cooked beef or mutton stew, eaten at breakfast in Old Delhi", False),
        ),
        aliases=("new delhi", "old delhi", "ncr"),
        menu_keywords=("dal makhani", "naan", "paneer"),
    ),
    Place(
        "Kolkata",
        "Kolkata is famous for Bengali sweets, fish and street rolls.",
        (
            Dish("Rosogolla", "spongy cottage-cheese balls in light syrup", True),
            Dish("Kathi Roll", "paratha wrapped around kebabs or paneer", False),
            Dish("Macher Jhol", "light Bengali fish curry eaten with rice", False),
            Dish("Kosha Mangsho", "slow-cooked spicy mutton", False),
            Dish("Mishti Doi", "sweet caramelised set yoghurt", True),
            Dish("Puchka", "Kolkata's tangy take on pani puri", True),
        ),
        aliases=("calcutta", "west bengal", "bengal", "bengali"),
    ),
    Place(
        "Chennai",
        "Chennai is famous for Tamil breakfasts and fiery Chettinad food.",
        (
            Dish("Idli & Sambar", "steamed rice cakes with lentil-vegetable stew", True),
            Dish("Ven Pongal", "peppery rice and moong dal with ghee", True),
            Dish("Masala Dosa", "crisp rice crêpe with spiced potato", True),
            Dish("Chettinad Chicken", "chicken in a bold roasted-spice gravy", False),
            Dish("Filter Coffee", "strong decoction coffee frothed with milk", True),
        ),
        aliases=("madras", "tamil nadu"),
    ),
    Place(
        "Bengaluru",
        "Bengaluru is famous for its old-school darshini breakfasts.",
        (
            Dish("Masala Dosa", "crisp dosa — the city's iconic breakfast at spots like Vidyarthi Bhavan", True),
            Dish("Bisi Bele Bath", "spiced rice, lentils and vegetables cooked together", True),
            Dish("Ragi Mudde", "finger-millet balls eaten with saaru or curry", True),
            Dish("Donne Biryani", "green, herby biryani served in leaf cups", False),
            Dish("Mysore Pak", "rich gram-flour and ghee sweet", True),
        ),
        aliases=("bangalore", "karnataka"),
    ),
    Place(
        "Mysuru",
        "Mysuru is famous for royal Karnataka sweets and dosas.",
        (
            Dish("Mysore Pak", "melt-in-the-mouth gram-flour and ghee sweet", True),
            Dish("Mysore Masala Dosa", "dosa lined with spicy red chutney", True),
            Dish("Mysore Bonda", "fluffy fried lentil-flour fritters", True),
            Dish("Nanjangud Rasabale", "a local banana variety", True),
        ),
        aliases=("mysore",),
    ),
    Place(
        "Lucknow",
        "Lucknow is famous for refined Awadhi cooking.",
        (
            Dish("Galouti Kebab", "ultra-soft minced-meat kebab — Tunday Kababi is legendary", False),
            Dish("Awadhi Biryani", "fragrant, delicately spiced dum biryani", False),
            Dish("Nihari Kulcha", "slow-cooked meat stew with soft kulcha", False),
            Dish("Basket Chaat", "chaat served in a crisp potato basket", True),
            Dish("Makhan Malai", "airy saffron milk froth, a winter treat", True),
        ),
        aliases=("uttar pradesh", "awadh"),
        menu_keywords=("naan",),
    ),
    Place(
        "Jaipur",
        "Jaipur and Rajasthan are famous for hearty desert cuisine.",
        (
            Dish("Dal Baati Churma", "baked wheat balls with lentils and sweet crumble", True),
            Dish("Laal Maas", "fiery red mutton curry", False),
            Dish("Gatte ki Sabzi", "gram-flour dumplings in yoghurt curry", True),
            Dish("Pyaaz Kachori", "flaky fried pastry with spicy onion filling", True),
            Dish("Ghewar", "honeycomb-like sweet soaked in syrup", True),
        ),
        aliases=("rajasthan", "jodhpur", "udaipur"),
    ),
    Place(
        "Punjab",
        "Punjab is famous for generous, buttery home-style food.",
        (
            Dish("Amritsari Kulcha", "stuffed tandoori bread with chole", True),
            Dish("Sarson da Saag & Makki di Roti", "mustard greens with corn flatbread", True),
            Dish("Amritsari Fish", "spiced, batter-fried fish", False),
            Dish("Dal Makhani", "creamy slow-cooked black lentils", True),
            Dish("Lassi", "thick sweet yoghurt drink", True),
        ),
        aliases=("amritsar", "chandigarh", "ludhiana", "punjabi"),
        menu_keywords=("dal makhani", "naan", "paneer"),
    ),
    Place(
        "Goa",
        "Goa is famous for coastal seafood with Portuguese influences.",
        (
            Dish("Goan Fish Curry & Rice", "coconut-kokum fish curry, the everyday staple", False),
            Dish("Pork Vindaloo", "tangy, spicy vinegar-garlic pork", False),
            Dish("Chicken Xacuti", "curry with roasted coconut and spices", False),
            Dish("Prawn Balchão", "spicy, pickle-like prawn preparation", False),
            Dish("Bebinca", "layered coconut-egg dessert", True),
        ),
    ),
    Place(
        "Kerala",
        "Kerala is famous for coconut, spice and seafood cooking.",
        (
            Dish("Appam & Stew", "lacy rice pancakes with mild coconut stew", True),
            Dish("Puttu & Kadala Curry", "steamed rice cylinders with black-chickpea curry", True),
            Dish("Karimeen Pollichathu", "pearl-spot fish cooked in banana leaf", False),
            Dish("Kerala Sadya", "vegetarian feast served on a banana leaf", True),
            Dish("Malabar Parotta", "flaky layered flatbread, great with beef or chicken fry", True),
        ),
        aliases=("kochi", "cochin", "trivandrum", "thiruvananthapuram", "kozhikode", "calicut"),
    ),
    Place(
        "Gujarat",
        "Gujarat is famous for sweet-savoury vegetarian food.",
        (
            Dish("Dhokla", "steamed, spongy gram-flour cakes", True),
            Dish("Khandvi", "soft gram-flour rolls tempered with mustard seeds", True),
            Dish("Undhiyu", "winter mixed-vegetable casserole", True),
            Dish("Fafda-Jalebi", "crisp gram-flour strips with jalebi — a Sunday breakfast", True),
            Dish("Gujarati Thali", "a full platter of dal, kadhi, sabzi, rotli and sweets", True),
        ),
        aliases=("ahmedabad", "surat", "vadodara", "baroda"),
    ),
    Place(
        "Kashmir",
        "Kashmir is famous for aromatic Wazwan cuisine.",
        (
            Dish("Rogan Josh", "mutton in a deep red, aromatic gravy", False),
            Dish("Gushtaba", "velvety meatballs in yoghurt gravy, the Wazwan finale", False),
            Dish("Yakhni", "mutton in a delicate yoghurt-fennel curry", False),
            Dish("Kashmiri Dum Aloo", "baby potatoes in a spiced yoghurt gravy", True),
            Dish("Kahwa", "green tea with saffron, cardamom and almonds", True),
        ),
        aliases=("srinagar", "jammu and kashmir"),
    ),
    Place(
        "Varanasi",
        "Varanasi is famous for its street breakfasts and sweets.",
        (
            Dish("Kachori Sabzi", "fried kachori with spicy potato curry", True),
            Dish("Tamatar Chaat", "spiced tomato chaat unique to the city", True),
            Dish("Malaiyyo", "winter dew-set saffron milk froth", True),
            Dish("Banarasi Paan", "the city's famous betel-leaf digestive", True),
            Dish("Lassi", "thick lassi served in clay kulhads", True),
        ),
        aliases=("banaras", "benares", "kashi"),
    ),
    Place(
        "Indore",
        "Indore is famous for snacks and its night food market, Sarafa Bazaar.",
        (
            Dish("Poha-Jalebi", "flattened rice with sev, paired with jalebi", True),
            Dish("Bhutte ka Kees", "grated corn cooked with milk and spices", True),
            Dish("Garadu", "fried spiced yam, a winter street snack", True),
            Dish("Dal Bafla", "Malwa's take on dal baati", True),
        ),
        aliases=("madhya pradesh",),
    ),
    Place(
        "Bihar",
        "Bihar is famous for rustic, sattu-based food.",
        (
            Dish("Litti Chokha", "roasted sattu-stuffed wheat balls with smoky mash", True),
            Dish("Sattu Paratha", "flatbread stuffed with roasted gram flour", True),
            Dish("Khaja", "flaky layered sweet", True),
            Dish("Thekua", "crunchy jaggery cookies made for Chhath", True),
        ),
        aliases=("patna",),
    ),
    Place(
        "Odisha",
        "Odisha is famous for temple food and chhena sweets.",
        (
            Dish("Pakhala Bhata", "fermented rice in water, a summer staple", True),
            Dish("Dalma", "lentils cooked with vegetables", True),
            Dish("Chhena Poda", "baked caramelised cottage-cheese dessert", True),
            Dish("Rasabali", "fried chhena discs in thickened milk", True),
        ),
        aliases=("orissa", "bhubaneswar", "odia"),
    ),
    Place(
        "Assam",
        "Assam is famous for light, sour curries and tea.",
        (
            Dish("Masor Tenga", "tangy fish curry", False),
            Dish("Khar", "alkaline dish made with raw papaya or pulses", True),
            Dish("Duck with Ash Gourd", "a festive Assamese curry", False),
            Dish("Pitha", "rice cakes, especially at Bihu", True),
            Dish("Assam Tea", "strong, malty black tea", True),
        ),
        aliases=("guwahati",),
    ),
    Place(
        "Agra",
        "Agra is famous for petha and its breakfast street food.",
        (
            Dish("Agra Petha", "translucent ash-gourd sweet", True),
            Dish("Bedai & Jalebi", "crisp stuffed puri with curry, then jalebi", True),
            Dish("Dalmoth", "spiced lentil namkeen", True),
        ),
    ),
    Place(
        "Pune",
        "Pune is famous for spicy Maharashtrian snacks.",
        (
            Dish("Misal Pav", "fiery sprout curry with pav", True),
            Dish("Mastani", "thick milkshake topped with ice cream", True),
            Dish("Bakarwadi", "crisp, sweet-spicy rolled snack", True),
            Dish("Sabudana Khichdi", "tapioca pearls with peanuts", True),
        ),
    ),
    Place(
        "Andhra Pradesh",
        "Andhra is famous for some of India's spiciest food.",
        (
            Dish("Gongura Pachadi", "sour sorrel-leaf chutney", True),
            Dish("Pesarattu", "green moong dosa, often with upma", True),
            Dish("Andhra Chicken Curry", "fiery, red-chilli chicken", False),
            Dish("Pootharekulu", "paper-thin rice-starch sweet with jaggery", True),
        ),
        aliases=("andhra", "vijayawada", "visakhapatnam", "vizag", "guntur"),
    ),
    Place(
        "Italy",
        "Italy is famous for regional pasta, pizza and simple ingredients.",
        (
            Dish("Pizza Napoletana", "soft, blistered Naples-style pizza", True),
            Dish("Spaghetti Carbonara", "Roman pasta with egg, pecorino and guanciale", False),
            Dish("Risotto alla Milanese", "creamy saffron risotto", True),
            Dish("Lasagne alla Bolognese", "layered pasta with ragù", False),
            Dish("Tiramisu", "coffee-soaked mascarpone dessert", True),
        ),
        aliases=("rome", "naples", "milan", "italian"),
    ),
    Place(
        "Japan",
        "Japan is famous for precise, seasonal cooking.",
        (
            Dish("Sushi", "vinegared rice with raw fish or vegetables", False),
            Dish("Ramen", "noodles in rich broth — every region has a style", False),
            Dish("Tempura", "light, crisp battered seafood and vegetables", False),
            Dish("Okonomiyaki", "savoury cabbage pancake from Osaka and Hiroshima", False),
            Dish("Matcha Sweets", "green-tea desserts", True),
        ),
        aliases=("tokyo", "osaka", "kyoto", "japanese"),
    ),
    Place(
        "Thailand",
        "Thailand is famous for balancing sweet, sour, salty and spicy.",
        (
            Dish("Pad Thai", "stir-fried rice noodles with tamarind", False),
            Dish("Tom Yum", "hot-and-sour lemongrass soup", False),
            Dish("Green Curry", "coconut curry with green chilli paste", False),
            Dish("Som Tam", "spicy green papaya salad", True),
            Dish("Mango Sticky Rice", "coconut rice with ripe mango", True),
        ),
        aliases=("bangkok", "thai"),
    ),
    Place(
        "Mexico",
        "Mexico is famous for corn, chillies and street tacos.",
        (
            Dish("Tacos al Pastor", "spit-roasted pork tacos with pineapple", False),
            Dish("Mole Poblano", "complex chilli-chocolate sauce", False),
            Dish("Chilaquiles", "tortilla chips simmered in salsa", True),
            Dish("Tamales", "steamed corn dough parcels", False),
            Dish("Churros", "fried dough with cinnamon sugar", True),
        ),
        aliases=("mexico city", "mexican"),
    ),
    Place(
        "China",
        "China is famous for its many regional cuisines.",
        (
            Dish("Peking Duck", "crisp roast duck with pancakes", False),
            Dish("Dim Sum", "Cantonese small plates and dumplings", False),
            Dish("Mapo Tofu", "spicy Sichuan tofu with numbing pepper", False),
            Dish("Xiaolongbao", "Shanghai soup dumplings", False),
            Dish("Hand-pulled Noodles", "Lanzhou-style noodles in broth", False),
        ),
        aliases=("beijing", "shanghai", "chinese"),
    ),
    Place(
        "France",
        "France is famous for bakeries and classic bistro cooking.",
        (
            Dish("Croissant", "buttery laminated pastry", True),
            Dish("Coq au Vin", "chicken braised in red wine", False),
            Dish("Ratatouille", "Provençal vegetable stew", True),
            Dish("Crêpes", "thin pancakes, sweet or savoury", True),
            Dish("Crème Brûlée", "custard with a caramel crust", True),
        ),
        aliases=("paris", "french"),
    ),
    Place(
        "United States",
        "The US is famous for regional comfort food.",
        (
            Dish("Burgers", "the all-American classic", False),
            Dish("New York Pizza", "big, foldable thin-crust slices", True),
            Dish("Texas BBQ Brisket", "slow-smoked beef brisket", False),
            Dish("Southern Fried Chicken", "crisp buttermilk fried chicken", False),
            Dish("Apple Pie", "the classic American dessert", True),
        ),
        aliases=("usa", "america", "new york", "texas"),
    ),
    Place(
        "United Kingdom",
        "The UK is famous for pub classics and Sunday roasts.",
        (
            Dish("Fish and Chips", "battered fish with thick chips", False),
            Dish("Sunday Roast", "roast meat with Yorkshire pudding and gravy", False),
            Dish("Full English Breakfast", "eggs, bacon, sausage, beans and toast", False),
            Dish("Chicken Tikka Masala", "a British-Indian favourite", False),
            Dish("Scones with Clotted Cream", "afternoon-tea staple", True),
        ),
        aliases=("uk", "england", "london", "britain"),
    ),
    Place(
        "Turkey",
        "Turkey is famous for kebabs, meze and pastries.",
        (
            Dish("Döner Kebab", "spit-roasted meat in bread", False),
            Dish("Iskender Kebab", "kebab over bread with tomato sauce and yoghurt", False),
            Dish("Lahmacun", "thin flatbread with spiced minced meat", False),
            Dish("Meze", "small plates like hummus and stuffed vine leaves", True),
            Dish("Baklava", "layered nut pastry in syrup", True),
        ),
        aliases=("istanbul", "turkish", "türkiye"),
    ),
    Place(
        "South Korea",
        "Korea is famous for fermented flavours and barbecue.",
        (
            Dish("Kimchi", "spicy fermented cabbage", True),
            Dish("Korean BBQ", "grilled marinated meats at the table", False),
            Dish("Bibimbap", "rice bowl with vegetables, egg and gochujang", True),
            Dish("Tteokbokki", "chewy rice cakes in spicy sauce", True),
            Dish("Korean Fried Chicken", "extra-crisp, glazed fried chicken", False),
        ),
        aliases=("korea", "seoul", "korean"),
    ),
)


def _pattern(term: str) -> re.Pattern[str]:
    return re.compile(rf"(?<![a-z]){re.escape(term)}(?![a-z])")


_INDEX: list[tuple[str, re.Pattern[str], Place]] = sorted(
    (
        (term, _pattern(term), place)
        for place in PLACES
        for term in (place.name.lower(), *place.aliases)
    ),
    key=lambda entry: len(entry[0]),
    reverse=True,
)


def find_place(text: str) -> Place | None:
    lowered = text.lower()
    for _, pattern, place in _INDEX:
        if pattern.search(lowered):
            return place
    return None


def answer_from_guide(question: str, menu_item_names: list[tuple[str, str]]) -> str:
    """Answer a "what is <place> famous for" question from the built-in guide.

    menu_item_names holds (name, price label) pairs for available menu items.
    """
    place = find_place(question)
    if place is None:
        examples = ", ".join(entry.name for entry in PLACES[:6])
        return (
            "Tell me a city, state or country and I'll list the dishes it's famous for.\n\n"
            f"- Try places like **{examples}**, Kerala, Goa, Italy or Japan.\n"
            "- For example: \"What is Lucknow famous for?\""
        )

    lines = [place.intro, ""]
    for dish in place.dishes:
        tag = " (veg)" if dish.veg else ""
        lines.append(f"- **{dish.name}** — {dish.blurb}{tag}.")

    matches = [
        f"**{name}** ({price})"
        for name, price in menu_item_names
        if any(keyword in name.lower() for keyword in place.menu_keywords)
    ]
    if matches:
        lines += ["", f"On our menu right now: {', '.join(matches)}."]
    return "\n".join(lines)
