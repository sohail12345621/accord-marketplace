from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Commitment, Deal, DealEvent, Dispute, Evidence, Listing, Message, User
from .security import hash_password
from .services.assistants import dispute_summarizer
from .services.commitments import extract_commitments
from .services.deals import add_commitments


def seed_database(db: Session):
    # Check if already seeded
    if db.scalar(select(User).limit(1)):
        return

    # 1. Demo Users
    # Password for all demo accounts: AccordDemo2026!
    pwd = hash_password("AccordDemo2026!")

    buyer = User(
        id="usr_buyer_demo",
        email="buyer@accord.demo",
        name="Aarav Sharma",
        password_hash=pwd,
        role="user",
        chat_id="accord_usr_buyer_demo",
        city="Bengaluru, KA",
        avatar_color="#0284c7",
        verified_identity=True,
        member_since=datetime.now() - timedelta(days=400),
        completed_transactions=12,
        disputed_transactions=0,
        response_rate=0.98,
        rating_sum=48.0,
        rating_count=10,
        commitments_kept=14,
        commitments_total=14,
    )

    seller = User(
        id="usr_seller_demo",
        email="seller@accord.demo",
        name="Vikramaditya Rao",
        password_hash=pwd,
        role="user",
        chat_id="accord_usr_seller_demo",
        city="Mumbai, MH",
        avatar_color="#0f766e",
        verified_identity=True,
        member_since=datetime.now() - timedelta(days=880),
        completed_transactions=47,
        disputed_transactions=2,
        disputes_lost=0,
        response_rate=0.96,
        rating_sum=218.0,
        rating_count=46,
        commitments_kept=72,
        commitments_total=74,
    )

    support = User(
        id="usr_support_demo",
        email="support@accord.demo",
        name="Accord Support Lead",
        password_hash=pwd,
        role="support",
        chat_id="accord_usr_support_demo",
        city="HQ Operations",
        avatar_color="#7c3aed",
        verified_identity=True,
        member_since=datetime.now() - timedelta(days=1200),
        completed_transactions=0,
        disputed_transactions=0,
        response_rate=1.0,
        rating_sum=5.0,
        rating_count=1,
    )

    db.add_all([buyer, seller, support])
    db.flush()

    # 2. Marketplace Listings
    listings_data = [
        {
            "id": "list_iphone14pro",
            "seller_id": seller.id,
            "title": "iPhone 14 Pro — 256GB Deep Purple (Flawless)",
            "category": "Smartphones",
            "price": 68000,
            "condition": "Excellent",
            "location": "Mumbai, Bandra West",
            "image_url": "https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?auto=format&fit=crop&w=800&q=80",
            "description": "Upgrading to 16 Pro. Phone has always had tempered glass and an Apple silicone case since day 1. Clean IMEI, bill and original box available.",
            "specs": {
                "Storage": "256 GB",
                "Color": "Deep Purple",
                "Battery Health": "92%",
                "Warranty": "Expired Nov 2024",
                "Repair History": "No previous repairs",
                "Included Accessories": "Original box, Braided USB-C to Lightning cable",
            },
        },
        {
            "id": "list_mbp_m2pro",
            "seller_id": seller.id,
            "title": "MacBook Pro 14\" (M2 Pro 16GB / 512GB SSD) Space Gray",
            "category": "Laptops",
            "price": 132000,
            "condition": "Like New",
            "location": "Mumbai, Powai",
            "image_url": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80",
            "description": "Sparingly used for light music production in studio environment. 42 battery cycles only. Apple 67W MagSafe brick and original packaging included.",
            "specs": {
                "Processor": "Apple M2 Pro (10-core CPU, 16-core GPU)",
                "RAM": "16 GB Unified",
                "Storage": "512 GB SSD",
                "Battery Cycles": "42",
                "Repair History": "Never opened or repaired",
                "Warranty": "AppleCare+ active till Dec 2026",
            },
        },
        {
            "id": "list_rtx4080",
            "seller_id": seller.id,
            "title": "ASUS TUF GeForce RTX 4080 OC Edition 16GB GDDR6X",
            "category": "GPUs",
            "price": 89000,
            "condition": "Like New",
            "location": "Mumbai, Andheri",
            "image_url": "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?auto=format&fit=crop&w=800&q=80",
            "description": "Never used for mining. Only used for weekend sim racing. Peak temperatures stay under 63C under full FurMark load. National warranty valid with invoice.",
            "specs": {
                "VRAM": "16 GB GDDR6X",
                "Mining History": "Never used for mining",
                "Warranty": "Valid until March 2027",
                "Max Temperature": "63°C under load",
                "Included Accessories": "Original box, anti-sag bracket, 16-pin adapter",
            },
        },
        {
            "id": "list_sony_a7iv",
            "seller_id": seller.id,
            "title": "Sony Alpha 7 IV (ILCE-7M4) Full-Frame Mirrorless Body",
            "category": "Cameras",
            "price": 145000,
            "condition": "Excellent",
            "location": "Mumbai, Colaba",
            "image_url": "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80",
            "description": "Shutter count is 7,850 only. Sensor is immaculate with zero dust or laser damage. Selling because switching to cinema line.",
            "specs": {
                "Shutter Count": "7850",
                "Sensor Condition": "Immaculate, zero scratches/dust",
                "Warranty": "6 months remaining",
                "Included Accessories": "2x NP-FZ100 batteries, dual charger, original strap",
            },
        },
        {
            "id": "list_ps5_disc",
            "seller_id": seller.id,
            "title": "Sony PlayStation 5 Disc Edition (CFI-1208A) + 2 DualSense",
            "category": "Gaming",
            "price": 38000,
            "condition": "Excellent",
            "location": "Mumbai, Thane",
            "image_url": "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=800&q=80",
            "description": "Clean console with original disc drive. Both DualSense controllers have zero stick drift. Tested and reset to factory settings.",
            "specs": {
                "Storage": "825 GB SSD",
                "Controllers": "2x DualSense (White + Midnight Black)",
                "Condition": "Zero stick drift, quiet fan",
                "Included Accessories": "HDMI 2.1 cable, stand, 2 controllers, power cord",
            },
        },
        {
            "id": "list_airpods_max",
            "seller_id": seller.id,
            "title": "Apple AirPods Max — Space Gray with Smart Case",
            "category": "Accessories",
            "price": 34000,
            "condition": "Good",
            "location": "Mumbai, Bandra",
            "image_url": "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=80",
            "description": "Ear cushions cleaned and sanitized. ANC and Transparency work perfectly. Small cosmetic scuff on the left aluminum cup.",
            "specs": {
                "Battery": "18+ hours on single charge",
                "ANC / Transparency": "100% functional",
                "Included Accessories": "Smart Case, Lightning to USB-C cable",
            },
        },
    ]

    for item in listings_data:
        db.add(
            Listing(
                id=item["id"],
                seller_id=item["seller_id"],
                title=item["title"],
                category=item["category"],
                price=item["price"],
                condition=item["condition"],
                location=item["location"],
                image_url=item["image_url"],
                description=item["description"],
                specs=item["specs"],
                history=[{"at": (datetime.now() - timedelta(days=4)).isoformat() + "Z", "event": f"Listed at ₹{item['price']:,}"}],
            )
        )
    db.flush()

    # 3. Seed Realistic Deal #AC-10482 (Demonstrates USP: Promises, Deal Ledger, Discrepancy & Dispute)
    deal_iphone = Deal(
        id="deal_demo_iphone",
        code="AC-10482",
        listing_id="list_iphone14pro",
        buyer_id=buyer.id,
        seller_id=seller.id,
        state="DISPUTED",
        agreed_price=64000,
        proposed_price=64000,
        proposed_by="buyer",
        last_message_at=datetime.now() - timedelta(hours=2),
    )
    db.add(deal_iphone)
    db.flush()

    # Conversation messages
    chat_steps = [
        (buyer.id, "Hi Vikram! Is the iPhone 14 Pro still available? Could you confirm the exact battery health and if it has any repair history?"),
        (seller.id, "Hi Aarav! Yes it is. Battery health is 92%, original charger included, no repairs at all. Flawless condition."),
        (buyer.id, "Awesome. Would you be willing to do ₹64,000 if I pay into Accord escrow today? Also when can you ship it?"),
        (seller.id, "Deal at ₹64,000 is good with me. I'll include the original charger and original box. I will ship it tomorrow morning via BlueDart."),
        (buyer.id, "Perfect! Accepted ₹64,000. Let's lock this into the Deal Ledger."),
        (buyer.id, "Hey Vikram, package arrived today. But when I checked Settings → Battery, the battery health is 81%, not 92% as promised!"),
    ]

    msgs = []
    base_time = datetime.now() - timedelta(days=2)
    for idx, (sender_id, body) in enumerate(chat_steps):
        m = Message(
            id=f"msg_demo_iph_{idx+1}",
            deal_id=deal_iphone.id,
            sender_id=sender_id,
            body=body,
            transport="nexconn",
            risk_level="none",
            sent_at=base_time + timedelta(hours=idx * 6),
        )
        db.add(m)
        msgs.append(m)
    db.flush()

    # Structured Commitments for Deal Ledger
    commitments_seed = [
        Commitment(
            id="com_iph_batt",
            deal_id=deal_iphone.id,
            message_id=msgs[1].id,
            party="seller",
            type="PRODUCT_ATTRIBUTE",
            attribute="battery_health",
            label="Battery Health",
            value="92%",
            source_text="Battery health is 92%, original charger included, no repairs at all.",
            confidence=0.98,
            origin="ai_extracted",
            status="discrepancy",
            reported_value="81%",
            reported_by=buyer.id,
        ),
        Commitment(
            id="com_iph_rep",
            deal_id=deal_iphone.id,
            message_id=msgs[1].id,
            party="seller",
            type="PRODUCT_ATTRIBUTE",
            attribute="repair_history",
            label="Repair History",
            value="No previous repairs",
            source_text="no repairs at all",
            confidence=0.95,
            origin="ai_extracted",
            status="active",
        ),
        Commitment(
            id="com_iph_chg",
            deal_id=deal_iphone.id,
            message_id=msgs[3].id,
            party="seller",
            type="INCLUDED_ITEM",
            attribute="original_charger",
            label="Included Item",
            value="Original charger",
            source_text="I'll include the original charger and original box.",
            confidence=0.96,
            origin="ai_extracted",
            status="fulfilled",
        ),
        Commitment(
            id="com_iph_box",
            deal_id=deal_iphone.id,
            message_id=msgs[3].id,
            party="seller",
            type="INCLUDED_ITEM",
            attribute="original_box",
            label="Included Item",
            value="Original box",
            source_text="I'll include the original charger and original box.",
            confidence=0.95,
            origin="ai_extracted",
            status="fulfilled",
        ),
        Commitment(
            id="com_iph_ship",
            deal_id=deal_iphone.id,
            message_id=msgs[3].id,
            party="seller",
            type="FULFILLMENT",
            attribute="shipping_date",
            label="Ship By",
            value="Tomorrow",
            source_text="I will ship it tomorrow morning via BlueDart.",
            confidence=0.94,
            origin="ai_extracted",
            status="fulfilled",
        ),
        Commitment(
            id="com_iph_price",
            deal_id=deal_iphone.id,
            party="buyer",
            type="PRICE",
            attribute="agreed_price",
            label="Agreed Price",
            value="₹64,000",
            source_text="Deal at ₹64,000 accepted in Accord",
            confidence=1.0,
            origin="confirmed",
            status="active",
        ),
    ]
    for c in commitments_seed:
        db.add(c)
    db.flush()

    # Deal events
    events = [
        ("LISTED", "CONVERSATION_STARTED", "Buyer opened inquiry"),
        ("CONVERSATION_STARTED", "NEGOTIATING", "Price and condition discussed"),
        ("NEGOTIATING", "AGREED", "Agreed at ₹64,000 with 5 commitments tracked"),
        ("AGREED", "PAYMENT_PENDING", "Buyer initiated escrow deposit"),
        ("PAYMENT_PENDING", "PAID", "₹64,000 secured in Accord escrow"),
        ("PAID", "FULFILLMENT_PENDING", "Seller accepted dispatch order"),
        ("FULFILLMENT_PENDING", "FULFILLED", "Seller shipped via BlueDart (AWB #84910291)"),
        ("FULFILLED", "DISPUTED", "Battery health reported 81% vs 92% promised"),
    ]
    for from_s, to_s, note in events:
        db.add(DealEvent(deal_id=deal_iphone.id, from_state=from_s, to_state=to_s, note=note))

    # Dispute Workspace #AC-20491
    dispute_iphone = Dispute(
        id="disp_demo_iphone",
        code="AC-20491",
        deal_id=deal_iphone.id,
        opened_by=buyer.id,
        commitment_id="com_iph_batt",
        issue="Battery health discrepancy",
        description="The seller explicitly stated 92% battery health in chat before I agreed to purchase. Upon delivery and setup, iOS Settings reports Maximum Capacity is 81% (Service recommended).",
        reported_value="81%",
        status="under_review",
    )
    db.add(dispute_iphone)
    db.flush()

    # Evidence items
    db.add(
        Evidence(
            dispute_id=dispute_iphone.id,
            submitted_by=buyer.id,
            role="buyer",
            kind="statement",
            text="I tested it right after unboxing. iOS Battery Health shows 81%. This significantly lowers the value and will need an immediate battery replacement at Apple.",
        )
    )
    db.add(
        Evidence(
            dispute_id=dispute_iphone.id,
            submitted_by=seller.id,
            role="seller",
            kind="statement",
            text="I checked battery health two months ago and it was 92%. It might have degraded while sitting in the drawer or after the recent iOS 18 update. I'm willing to offer a ₹4,000 partial refund for battery service.",
        )
    )
    db.flush()

    # Generate Case Summary
    dispute_iphone.summary = dispute_summarizer.build(db, dispute_iphone)

    # 4. Seed Deal #2 — Demonstrating Scam / Risk Detection Signal
    deal_scam = Deal(
        id="deal_demo_scam",
        code="AC-10519",
        listing_id="list_rtx4080",
        buyer_id=buyer.id,
        seller_id=seller.id,
        state="NEGOTIATING",
        agreed_price=None,
        proposed_price=None,
        last_message_at=datetime.now() - timedelta(minutes=45),
    )
    db.add(deal_scam)
    db.flush()

    scam_msg = Message(
        id="msg_demo_scam_1",
        deal_id=deal_scam.id,
        sender_id=seller.id,
        body="Don't pay here. Send ₹5,000 to my UPI and I'll reserve it for you immediately. Call me on 9820192831 right now.",
        transport="local",
        risk_level="high",
        risk_reasons=[
            "Request to pay outside the platform",
            "Upfront / advance payment pressure",
            "Urgency pressure",
            "Attempt to move conversation off-platform",
            "Attempt to bypass marketplace safeguards",
        ],
        sent_at=datetime.now() - timedelta(minutes=45),
    )
    db.add(scam_msg)

    db.commit()
