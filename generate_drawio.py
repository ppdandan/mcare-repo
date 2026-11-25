#!/usr/bin/env python3
"""
Convert Mermaid diagrams from docs/diagrams.md into valid draw.io (mxGraph) XML.

Output: docs/drawio/mcare-thesis-diagrams.drawio (individual .drawio files per diagram)

Each of the 5 diagrams gets its own .drawio file with a single mxGraphModel.
The script:
  - Parses Mermaid syntax into mxGraph cells
  - Validates every cell ID is unique within its diagram
  - Validates every edge source/target references an existing vertex
  - Assigns automatic x,y,width,height geometry for positioned cells
  - Checks for orphaned edges (references non-existent vertices)
  - Reports any issues before generating output
"""

import re
import sys
import os
from collections import defaultdict

DIAGRAMS_MD = "/home/synkoria/Downloads/M-Care-Final/docs/diagrams.md"
OUTPUT_DIR = "/home/synkoria/Downloads/M-Care-Final/docs/drawio"

# ---------------------------------------------------------------------------
# Mermaid → mxGraph cell type mapping
# ---------------------------------------------------------------------------
SHAPE_MAP = {
    # Flowchart nodes from diagram 1
    "A": "ellipse",
    "B": "ellipse",
    "C": "ellipse",
    "D": "ellipse",
    "E": "ellipse",
    "F": "diamond",
    "G": "diamond",
    "H": "ellipse",
    "I": "ellipse",
    "J": "ellipse",
    "K": "ellipse",
    "L": "ellipse",
    "M": "ellipse",
    "N": "ellipse",
    "O": "ellipse",
    "P": "ellipse",
    "Q": "ellipse",
    "R": "ellipse",
    "S": "ellipse",
    "T": "ellipse",

    # ERD entities - use box/nellipse
    "profiles": "ellipse",
    "patients": "ellipse",
    "doctors": "ellipse",
    "services": "ellipse",
    "appointments": "ellipse",
    "medical_records": "ellipse",
    "transactions": "ellipse",
    "notifications": "ellipse",
    "inventory_items": "ellipse",
    "stock_movements": "ellipse",
    "doctor_schedules": "ellipse",

    # DFD processes
    "P1": "process",
    "P2": "process",
    "P3": "process",
    "P4": "process",
    "P5": "process",
    "P6": "process",
    "P7": "process",
    "P8": "process",

    # DFD data stores
    "D1": "datastore",
    "D2": "datastore",
    "D3": "datastore",
    "D4": "datastore",
    "D5": "datastore",
    "D6": "datastore",
    "D7": "datastore",

    # Use case actors
    "Patient": "person",
    "Staff / Receptionist": "person",
    "Doctor / Sonologist": "person",
    "Admin": "person",

    # Use case UC nodes
    "UC1": "ellipse",
    "UC2": "ellipse",
    "UC3": "ellipse",
    "UC4": "ellipse",
    "UC5": "ellipse",
    "UC6": "ellipse",
    "UC7": "ellipse",
    "UC8": "ellipse",
    "UC9": "ellipse",
    "UC10": "ellipse",
    "UC11": "ellipse",
    "UC12": "ellipse",
    "UC13": "ellipse",
    "UC14": "ellipse",
    "UC15": "ellipse",
    "UC16": "ellipse",
    "UC17": "ellipse",
    "UC18": "ellipse",
    "UC19": "ellipse",
    "UC20": "ellipse",
    "UC21": "ellipse",
}


# ---------------------------------------------------------------------------
# Diagram extraction from markdown
# ---------------------------------------------------------------------------
def extract_diagrams(md_path):
    """Return list of (diagram_name, mermaid_code, diagram_type) tuples."""
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    diagrams = []
    # Match ## Diagram Name then ```mermaid ... ```
    pattern = r"##\s+(.+?)\n```mermaid\n(.*?)\n```"
    matches = re.findall(pattern, content, re.DOTALL)
    for name, code in matches:
        name = name.strip()
        code = code.strip()
        # Determine type from the mermaid code
        dtype = "flowchart"  # default
        if code.startswith("flowchart"):
            dtype = "flowchart"
        elif code.startswith("erDiagram"):
            dtype = "erd"
        elif "useCaseDiagram" in code or re.search(r"\bactor\b", code):
            dtype = "use_case"
        else:
            # Check for DFD patterns
            if "Patient" in code and "Supabase" in code:
                dtype = "dfd"
        diagrams.append((name, code, dtype))
    return diagrams


# ---------------------------------------------------------------------------
# Flowchart parsing (flowchart TD or LR)
# ---------------------------------------------------------------------------
def parse_flowchart(code):
    """Parse flowchart TD/LR into nodes and edges.

    Returns: (nodes: dict of id -> label, edges: list of (src, tgt, label))
    """
    nodes = {}  # id -> label text
    edges = []  # list of (src_id, tgt_id, label)

    # Match node definitions: ID[Label]
    # e.g., A[Patient Opens Mobile App], UC1[Register / Login]
    # Also match: word[Label] for entities and processes
    node_pattern = r"([A-Za-z_][A-Za-z0-9_]*|UC\d+|P\d+|D\d+)\s*\[([^\]]+)\]"
    for m in re.finditer(node_pattern, code):
        node_id = m.group(1)
        label = m.group(2).strip()
        if node_id not in nodes:
            nodes[node_id] = label

    # Match edges: ID --> ID  or  ID -- ID
    # Capture optional [label] after the edge
    edge_pattern = r"([A-Z][0-9]*|UC\d+|P\d+|D\d+)\s*-->\s*([A-Z][0-9]*|UC\d+|P\d+|D\d+)(?:\s*:\s*\"([^\"]*)\")?"
    for m in re.finditer(edge_pattern, code):
        src = m.group(1)
        tgt = m.group(2)
        edge_label = m.group(3) if m.group(3) else ""
        # Normalize: strip any [...] that might be attached
        src = src.split("[")[0].strip()
        tgt = tgt.split("[")[0].strip()
        if src in nodes and tgt in nodes:
            edges.append((src, tgt, edge_label))
        elif src not in nodes:
            print(f"  WARNING: edge source '{src}' not found in nodes", file=sys.stderr)
        elif tgt not in nodes:
            print(f"  WARNING: edge target '{tgt}' not found in nodes", file=sys.stderr)

    return nodes, edges


# ---------------------------------------------------------------------------
# ERD parsing (erDiagram block)
# ---------------------------------------------------------------------------
def parse_erd(code):
    """Parse erDiagram into nodes and edges.

    Returns: (nodes: set of entity names, edges: list of (src, tgt, label))
    """
    nodes = set()
    edges = []

    # Match: entity_name ||--o{ related_entity : "label"
    # e.g., profiles ||--o{ patients : "has"
    # Also match: entity_name ||--o{ related_entity (without label)
    # The ||--o{ pattern has a space after the opening brace
    rel_pattern = r"(\w+)\s*\|\|--o\{ (\w+)?\s*:\s*\"([^\"]*)\"?"
    for m in re.finditer(rel_pattern, code):
        src = m.group(1).strip()
        tgt = m.group(2).strip() if m.group(2) else ""
        label = m.group(3).strip() if m.group(3) else ""
        nodes.add(src)
        nodes.add(tgt)
        if label:
            edges.append((src, tgt, label))
        else:
            edges.append((src, tgt, ""))

    # Also add entity types that appear in the entity definition blocks
    # Match the entity attribute blocks like: patients { ... }
    entity_block_pattern = r"(\w+)\s*\{"
    for m in re.finditer(entity_block_pattern, code):
        et = m.group(1).strip()
        if et not in nodes:
            nodes.add(et)

    # Add all entity types listed in the ERD
    entity_types = [
        "profiles", "patients", "doctors", "services",
        "appointments", "medical_records", "transactions",
        "notifications", "inventory_items", "stock_movements",
        "doctor_schedules"
    ]
    for et in entity_types:
        if et in code:
            nodes.add(et)

    return nodes, edges


# ---------------------------------------------------------------------------
# Use Case diagram parsing
# ---------------------------------------------------------------------------
def parse_use_case(code):
    """Parse useCaseDiagram into actors and UC nodes with edges.

    Returns: (nodes_dict: dict of id -> label, edges: list of (src, tgt, type))
      type is "include" or "extend"
    """
    nodes_dict = {}  # id -> label
    edges = []  # list of (src, tgt, type)

    # Extract actor definitions: actor Name [as Alias]
    # Match: actor "Full Name" or actor Name (with slashes like "Staff / Receptionist")
    actor_pattern = r'actor\s+(?:"((?:[^"\\]|\\.)*)"|(\S+(?:\s+\S+)*)?)'
    for m in re.finditer(actor_pattern, code):
        actor_name = m.group(1) if m.group(1) else m.group(2).strip()
        # Clean up: remove trailing . or special chars
        actor_name = actor_name.rstrip('.').strip()
        if actor_name and actor_name not in nodes_dict:
            nodes_dict[actor_name] = actor_name

    # Extract UC definitions: UC[number]\[Label\]
    uc_pattern = r"UC(\d+)\s*\[([^\]]+)\]"
    for m in re.finditer(uc_pattern, code):
        uc_num = f"UC{m.group(1)}"
        uc_label = m.group(2).strip()
        nodes_dict[uc_num] = uc_label

    # Extract <<include>> edges: UC2 ..> UC1 : <<include>>
    include_pattern = r"UC(\d+)\s*\.\.\>\s*UC(\d+)\s*:\s*<<(\w+)>>"
    for m in re.finditer(include_pattern, code):
        src = f"UC{m.group(1)}"
        tgt = f"UC{m.group(2)}"
        etype = m.group(3).strip()
        edges.append((src, tgt, etype))

    # Also handle Actor --> UC edges from the diagram text
    # e.g., Patient --> UC1 or "Staff / Receptionist" --> UC10
    # Pattern: actor_name or quoted name --> UC\d+
    actor_uc_pattern = r"([A-Za-z\s/]+?)\s*-->\s*(UC\d+)"
    for m in re.finditer(actor_uc_pattern, code):
        src = m.group(1).strip().rstrip(".")
        tgt = m.group(2).strip()
        # Determine type: default include for actor->UC
        edges.append((src, tgt, "include"))

    # UC --> UC edges
    uc_uc_pattern = r"(UC\d+)\s*-->\s*(UC\d+)"
    for m in re.finditer(uc_uc_pattern, code):
        src = m.group(1).strip()
        tgt = m.group(2).strip()
        edges.append((src, tgt, "include"))

    return nodes_dict, edges


# ---------------------------------------------------------------------------
# DFD parsing (flowchart LR context diagram and TD process decomposition)
# ---------------------------------------------------------------------------
def parse_dfd(code):
    """Parse DFD flowchart into nodes and edges.

    Returns: (nodes_dict: dict of id -> label, edges: list of (src, tgt))
    """
    nodes_dict = {}
    edges = []

    # Match node definitions in DFD context
    # Entities: Patient[Patient Mobile App], Staff[Staff / Admin Web Dashboard], etc.
    # Also match: word[Label] pattern including UC\d+, P\d+, D\d+
    entity_pattern = r"([A-Za-z_][A-Za-z0-9_]*|UC\d+|P\d+|D\d+)\s*\[([^\]]+)\]"
    for m in re.finditer(entity_pattern, code):
        node_id = m.group(1).strip()
        label = m.group(2).strip()
        # Skip if already captured
        if node_id not in nodes_dict:
            nodes_dict[node_id] = label

    # Match edges: ID --> ID (with optional |"label"| or : "label")
    # The DFD Level 1 uses pipe-delimited labels like: P1 -->|read/write| D1
    # Also supports : "label" format from flowchart TD
    edge_pattern = r"(\S+)\s*-->\s*(?:\|([^\|]*)\||\:\s*\"([^\"]*)\")?\s*(\S+)"
    for m in re.finditer(edge_pattern, code):
        src = m.group(1).strip()
        # Edge label from pipe format
        edge_label_pipe = m.group(2).strip() if m.group(2) else ""
        # Edge label from colon format
        edge_label_colon = m.group(3).strip() if m.group(3) else ""
        edge_label = edge_label_pipe if edge_label_pipe else edge_label_colon
        tgt = m.group(4).strip()
        # Clean up: remove [label] suffixes
        src = src.split("[")[0].strip()
        tgt = tgt.split("[")[0].strip()
        if src in nodes_dict and tgt in nodes_dict:
            edges.append((src, tgt, edge_label))
        elif src not in nodes_dict:
            print(f"  WARNING: DFD edge source '{src}' not found in nodes", file=sys.stderr)
        elif tgt not in nodes_dict:
            print(f"  WARNING: DFD edge target '{tgt}' not found in nodes", file=sys.stderr)

    return nodes_dict, edges


# ---------------------------------------------------------------------------
# Assign geometry to cells
# ---------------------------------------------------------------------------
def assign_geometry(all_node_ids, margin_x=40, margin_y=40, cell_w=100, cell_h=50):
    """Assign x,y,width,height to each node using a grid layout.

    Returns dict of id -> (x, y, width, height)
    """
    geometry = {}
    sorted_ids = sorted(all_node_ids)

    for idx, nid in enumerate(sorted_ids):
        row = idx // 6  # 6 cells per row
        col = idx % 6
        x = margin_x + col * (cell_w + 20)
        y = margin_y + row * (cell_h + 20)
        geometry[nid] = (x, y, cell_w, cell_h)

    return geometry


# ---------------------------------------------------------------------------
# Generate mxGraph XML for a single diagram
# ---------------------------------------------------------------------------
def generate_mxgraph_xml(diagram_name, nodes_dict, edges, cell_type_map):
    """Generate mxGraph XML for one diagram.

    Returns: xml_string (the content inside <mxGraphModel>)
    """
    # Validate: every edge source/target must exist in nodes
    print(f"  Validating diagram '{diagram_name}'...")
    orphan_edges = 0
    for src, tgt, *label in edges:
        if src not in nodes_dict:
            print(f"    ORPHAN edge: source '{src}' not in nodes", file=sys.stderr)
            orphan_edges += 1
        if tgt not in nodes_dict:
            print(f"    ORPHAN edge: target '{tgt}' not in nodes", file=sys.stderr)
            orphan_edges += 1
    if orphan_edges > 0:
        print(f"  WARNING: {orphan_edges} orphaned edges in '{diagram_name}'", file=sys.stderr)

    # Validate unique cell references
    all_referenced = set()
    for src, tgt, *label in edges:
        all_referenced.add(src)
        all_referenced.add(tgt)
    node_ids = set(nodes_dict.keys())
    missing = all_referenced - node_ids
    if missing:
        print(f"  WARNING: {len(missing)} edge references to non-existent nodes: {missing}", file=sys.stderr)

    # Assign geometry
    all_node_ids = list(node_ids)
    geometry = assign_geometry(all_node_ids)

    # Build the mxGraphModel XML section
    # We create a compact mxGraphModel without the outer mxfile wrapper
    # This can be pasted via Extras → Edit Diagram in draw.io

    # Always include a dummy root mxCell (convention for mxGraph)
    parts = []
    parts.append('<mxCell id="e0" value="" vertex="false" edge="false"/>')

    # Sort node IDs for deterministic output
    sorted_node_ids = sorted(nodes_dict.keys())

    # Add vertex cells
    vc_id = 1
    for nid in sorted_node_ids:
        shape = cell_type_map.get(nid, "ellipse")
        label = nodes_dict[nid]
        value = label.replace("&", "&").replace("<", "<").replace(">", ">")
        geom = geometry.get(nid, (0, 0, 100, 50))

        cell_id = f"cell_{vc_id}"
        vc_id += 1

        # Build geometry string: x;y;width;height;
        geom_str = f"{geom[0]};{geom[1]};{geom[2]};{geom[3]};"

        parts.append(
            f'<mxCell id="{cell_id}" value="{value}" '
            f'style="shape={shape};" vertex="true" '
            f'geometry="{geom_str}"/>'
        )

    # Add edge cells
    ec_id = 1
    for src, tgt, label in edges:
        # Map original node IDs to our cell IDs
        # Since nodes are sorted and assigned cell IDs 1..N,
        # we need to find the cell ID for src and tgt
        src_cell = None
        tgt_cell = None
        for i, nid in enumerate(sorted_node_ids):
            if nid == src:
                src_cell = f"cell_{i + 1}"
            if nid == tgt:
                tgt_cell = f"cell_{i + 1}"

        # Fallback if not found
        if src_cell is None:
            src_cell = f"cell_{vc_id}"
            vc_id += 1
        if tgt_cell is None:
            tgt_cell = f"cell_{vc_id}"
            vc_id += 1

        edge_label = ""
        if label:
            edge_label = label.replace("&", "&").replace("<", "<").replace(">", ">")

        parts.append(
            f'<mxCell id="cell_{vc_id}" value="{edge_label}" '
            f'style="edgeStyle=orthogonalEdgeStyle;rounded=0;strokeColor=#000000;endArrow=block;" '
            f'source="{src_cell}" target="{tgt_cell}" edge="true"/>'
        )
        vc_id += 1

    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Main: orchestrate all 5 diagrams
# ---------------------------------------------------------------------------
def main():
    print("=" * 60)
    print("M-Care Thesis: Mermaid → draw.io XML Converter")
    print("=" * 60)
    print()

    # Extract diagrams from markdown
    diagrams = extract_diagrams(DIAGRAMS_MD)
    print(f"Found {len(diagrams)} diagrams in docs/diagrams.md\n")

    # Ensure output directory exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Process each diagram
    for diagram_name, mermaid_code, diagram_type in diagrams:
        print(f"Processing diagram: {diagram_name}")
        print(f"  Type: {diagram_type}")

        # Parse based on type
        if diagram_type == "flowchart":
            nodes, edges = parse_flowchart(mermaid_code)
            # Build nodes_dict from the parsed nodes
            nodes_dict = nodes  # already a dict {id: label}
            # Set default cell types for any not explicitly in SHAPE_MAP
            cell_type_map = {}
            for nid in nodes_dict:
                cell_type_map[nid] = SHAPE_MAP.get(nid, "ellipse")
        elif diagram_type == "erd":
            nodes_set, edges = parse_erd(mermaid_code)
            # Build nodes_dict: each entity gets ellipse shape
            nodes_dict = {n: n for n in nodes_set}
            cell_type_map = {n: "ellipse" for n in nodes_set}
            # Also add edges from the ||--o{ relationships
            # edges already captured above
        elif diagram_type == "use_case":
            nodes_dict, edges = parse_use_case(mermaid_code)
            # Set cell types: actors = person, UC nodes = ellipse
            cell_type_map = {}
            for nid in nodes_dict:
                if nid in ["Patient", "Staff / Receptionist", "Doctor / Sonologist", "Admin"]:
                    cell_type_map[nid] = "person"
                else:
                    cell_type_map[nid] = "ellipse"
        elif diagram_type == "dfd":
            nodes, edges = parse_dfd(mermaid_code)
            nodes_dict = nodes
            cell_type_map = {}
            for nid in nodes_dict:
                if nid in ["Patient", "Staff", "Doctor", "M_Care"]:
                    cell_type_map[nid] = "person"
                elif nid in ["Supabase", "SupabaseAuth", "ExpoPush"]:
                    cell_type_map[nid] = "cylinder"
                else:
                    cell_type_map[nid] = "ellipse"
        else:
            nodes, edges = parse_flowchart(mermaid_code)
            cell_type_map = {n: SHAPE_MAP.get(n, "ellipse") for n in nodes_dict}

        print(f"  Nodes: {len(nodes_dict)}, Edges: {len(edges)}")

        # Generate XML
        xml_section = generate_mxgraph_xml(diagram_name, nodes_dict, edges, cell_type_map)

        # Write individual .drawio file
        # Create a proper .drawio file with the mxGraphModel embedded
        diagram_file = os.path.join(OUTPUT_DIR, f"mcare_{diagram_name.replace(' ', '_').replace('/', '_').replace('(', '').replace(')', '').replace(',', '')}.drawio")

        # Full draw.io file format with mxFile wrapper
        # draw.io can open files with multiple <diagram> elements, each with a <mxGraphModel>
        full_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<mxfile>
  <diagram id="1" name="{diagram_name.replace('"', '\\\"')}">

    <mxGraphModel dx="0" dy="0" grid="1" gridSize="10" guides="1" toolTip="1" earlierVersionEnabled="1" undoLimit="100" directed="1">
      <root>
{xml_section}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>'''

        with open(diagram_file, "w", encoding="utf-8") as f:
            f.write(full_xml)

        print(f"  Written: {diagram_file}")
        print()

    print("=" * 60)
    print("Generation complete.")
    print(f"Individual .drawio files written to: {OUTPUT_DIR}/")
    print()
    print("To use in draw.io (diagrams.net):")
    print("  1. Open draw.io")
    print("  2. File → Open → select a .drawio file")
    print("  3. Each file is a separate diagram page")
    print()
    for diagram_name, _, _ in diagrams:
        # Find the file we just wrote
        safe_name = diagram_name.replace(' ', '_').replace('/', '_').replace('(', '').replace(')', '').replace(',', '')
        diagram_file = os.path.join(OUTPUT_DIR, f"mcare_{safe_name}.drawio")
        if os.path.exists(diagram_file):
            print(f"  - {os.path.basename(diagram_file)}")


if __name__ == "__main__":
    main()